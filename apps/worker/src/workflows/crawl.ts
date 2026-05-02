import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { auditAccessibility } from "../auditor";
import { crawlPage, discoverPages } from "../crawler";
import { diffPage, updateBaselines } from "../differ";
import { sendAlertEmail } from "../notifier";
import type { A11yResult, CrawlConfig, DiffResult, Env, PageCrawlResult } from "../types";

const STEP_RETRY = { retries: { limit: 2, delay: "5 seconds", backoff: "exponential" } } as const;
const BATCH_SIZE = 5;

export class CrawlWorkflow extends WorkflowEntrypoint<Env, CrawlConfig> {
  async run(event: WorkflowEvent<CrawlConfig>, step: WorkflowStep) {
    const config = event.payload;

    // Step 1: Discover pages
    const pages = await step.do("discover-pages", STEP_RETRY, async () => {
      return discoverPages(config.baseUrl, config.maxPages, this.env.BROWSER);
    });

    // Step 2: Crawl in batches of 5
    const crawlResults: PageCrawlResult[] = [];

    for (let i = 0; i < pages.length; i += BATCH_SIZE) {
      const batch = pages.slice(i, i + BATCH_SIZE);

      const batchResults = await step.do(`crawl-batch-${i}`, { retries: { limit: 1, delay: "3 seconds", backoff: "exponential" } }, async () => {
        const results = await Promise.allSettled(batch.map((url) => crawlPage(url, config, this.env)));
        // Non-fatal: skip failed pages, log errors
        return results.flatMap((r) => {
          if (r.status === "fulfilled" && r.value.ok) return [r.value.value];
          if (r.status === "rejected") console.error("Page crawl failed:", r.reason);
          else if (!r.value.ok) console.error("Page crawl failed:", r.value.error);
          return [];
        });
      });

      crawlResults.push(...batchResults);

      await step.do(`update-progress-${i}`, async () => {
        await this.env.DB.prepare(
          "UPDATE runs SET pages_crawled = ?, status = 'running' WHERE id = ?"
        ).bind(crawlResults.length, config.runId).run();
      });
    }

    // Step 3: Vector diff all pages
    const diffResults: DiffResult[] = [];

    for (const crawlResult of crawlResults) {
      const result = await step.do(`diff-${crawlResult.path}`, STEP_RETRY, async () => {
        const r = await diffPage(crawlResult, config, this.env);
        if (!r.ok) throw new Error(r.error);
        return r.value;
      });
      diffResults.push(result);
    }

    // Step 4: Accessibility audit for drifted or new pages
    const pagesToAudit = diffResults.filter((d) => d.isDrift || d.isNewPage);
    const a11yResults: A11yResult[] = [];

    for (const diffResult of pagesToAudit) {
      const crawlResult = crawlResults.find((r) => r.path === diffResult.pageId);
      if (!crawlResult) continue;

      const a11y = await step.do(`audit-a11y-${diffResult.pageId}`, STEP_RETRY, async () => {
        return auditAccessibility(crawlResult, this.env);
      });
      a11yResults.push(a11y);
    }

    // Step 5: Persist findings to D1
    await step.do("persist-findings", STEP_RETRY, async () => {
      await persistFindings(diffResults, a11yResults, crawlResults, config, this.env);
    });

    // Step 6: Set baselines for new pages
    await step.do("update-baselines", STEP_RETRY, async () => {
      const newPages = diffResults.filter((d) => d.isNewPage);
      await updateBaselines(newPages, crawlResults, config, this.env);
    });

    // Step 7: Send notification if findings exist
    const driftCount = diffResults.filter((d) => d.isDrift).length;
    const a11yCount = a11yResults.reduce((acc, r) => acc + r.findings.length, 0);
    const totalFindings = driftCount + a11yCount;

    if (totalFindings > 0) {
      await step.do("send-notification", STEP_RETRY, async () => {
        await sendAlertEmail(config, totalFindings, this.env);
      });
    }

    // Step 8: Mark run complete
    await step.do("complete-run", async () => {
      await this.env.DB.prepare(
        `UPDATE runs SET status='completed', completed_at=?, findings_count=?, drift_count=?, a11y_count=? WHERE id=?`
      ).bind(Date.now(), totalFindings, driftCount, a11yCount, config.runId).run();

      await this.env.DB.prepare(
        "UPDATE projects SET last_run_at=? WHERE id=?"
      ).bind(Date.now(), config.projectId).run();
    });

    return { runId: config.runId, pagesChecked: crawlResults.length, findingsCount: totalFindings };
  }
}

async function persistFindings(
  diffResults: DiffResult[],
  a11yResults: A11yResult[],
  crawlResults: PageCrawlResult[],
  config: CrawlConfig,
  env: Env
): Promise<void> {
  const statements: D1PreparedStatement[] = [];

  // Ensure page rows exist
  for (const crawl of crawlResults) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO pages (id, project_id, url, path) VALUES (?, ?, ?, ?)
         ON CONFLICT(project_id, path) DO NOTHING`
      ).bind(crypto.randomUUID(), config.projectId, crawl.url, crawl.path)
    );
  }

  // Visual drift findings
  for (const diff of diffResults) {
    if (!diff.isDrift) continue;

    const pageRow = await env.DB.prepare(
      "SELECT id FROM pages WHERE project_id = ? AND path = ?"
    ).bind(config.projectId, diff.pageId).first<{ id: string }>();
    if (!pageRow) continue;

    const severity = diff.diffScore > 0.3 ? "critical" : diff.diffScore > 0.15 ? "major" : "minor";

    statements.push(
      env.DB.prepare(
        `INSERT INTO findings (id, run_id, page_id, finding_type, severity, description, screenshot_r2_key, baseline_r2_key, diff_score)
         VALUES (?, ?, ?, 'visual_drift', ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), config.runId, pageRow.id, severity,
        `Visual drift detected: ${(diff.diffScore * 100).toFixed(1)}% different from baseline`,
        diff.currentKey, diff.baselineKey, diff.diffScore
      )
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }

  // Accessibility findings (sequential to avoid D1 page-row races)
  for (const a11y of a11yResults) {
    const crawl = crawlResults.find((r) => r.url === a11y.url);
    if (!crawl) continue;

    const pageRow = await env.DB.prepare(
      "SELECT id FROM pages WHERE project_id = ? AND path = ?"
    ).bind(config.projectId, crawl.path).first<{ id: string }>();
    if (!pageRow) continue;

    const a11yStatements = a11y.findings.map((f) =>
      env.DB.prepare(
        `INSERT INTO findings (id, run_id, page_id, finding_type, severity, description, screenshot_r2_key, wcag_criterion)
         VALUES (?, ?, ?, 'accessibility', ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), config.runId, pageRow.id, f.severity,
        f.description, crawl.screenshotKey, f.wcagCriterion
      )
    );

    if (a11yStatements.length > 0) {
      await env.DB.batch(a11yStatements);
    }
  }
}
