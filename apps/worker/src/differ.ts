import type { CrawlConfig, DiffResult, Env, PageCrawlResult, Result } from "./types";
import { sanitizePath } from "./utils";

const DRIFT_THRESHOLD = 0.08;

export async function diffPage(
  crawlResult: PageCrawlResult,
  config: CrawlConfig,
  env: Env
): Promise<Result<DiffResult>> {
  try {
    // 1. Embed current screenshot via bge-large (base64 string as proxy for image content)
    // reason: Vectorize+Workers AI lacks a native CLIP endpoint; bge embeds the base64 string
    // as a high-dimensional proxy to detect structural changes across screenshots.
    const embedResult = await env.AI.run("@cf/baai/bge-large-en-v1.5", {
      text: [crawlResult.screenshotBase64],
    }) as { data: number[][] };
    const currentVector = embedResult.data[0];

    const safePath = sanitizePath(crawlResult.path);
    const vectorId = `${config.projectId}__${safePath}`;

    // 2. Query Vectorize for nearest baseline
    const queryResult = await env.SCREENSHOT_VECTORS.query(currentVector, {
      topK: 1,
      filter: { projectId: config.projectId, path: crawlResult.path, isBaseline: true },
      returnMetadata: "all",
    });

    const match = queryResult.matches[0];
    const isNewPage = !match || match.score === undefined;
    // Convert cosine similarity to distance: distance = 1 - similarity
    const diffScore = match?.score !== undefined ? 1 - match.score : 1;
    const isDrift = !isNewPage && diffScore > DRIFT_THRESHOLD;

    // 3. Upsert candidate vector (replaces baseline only on reviewer approval)
    await env.SCREENSHOT_VECTORS.upsert([{
      id: `${vectorId}__candidate__${config.runId}`,
      values: currentVector,
      metadata: {
        projectId: config.projectId,
        path: crawlResult.path,
        runId: config.runId,
        screenshotKey: crawlResult.screenshotKey,
        isBaseline: false,
      },
    }]);

    const baselineKey = match && !isNewPage
      ? ((match.metadata as Record<string, string>)?.screenshotKey ?? null)
      : null;

    return {
      ok: true,
      value: {
        pageId: crawlResult.path,
        url: crawlResult.url,
        diffScore,
        isDrift,
        currentKey: crawlResult.screenshotKey,
        baselineKey,
        isNewPage,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`diffPage failed for ${crawlResult.url}: ${msg}`);
    return { ok: false, error: msg };
  }
}

export async function updateBaselines(
  newPages: DiffResult[],
  crawlResults: PageCrawlResult[],
  config: CrawlConfig,
  env: Env
): Promise<void> {
  for (const page of newPages) {
    const crawlResult = crawlResults.find((r) => r.path === page.pageId);
    if (!crawlResult) continue;

    const safePath = sanitizePath(page.pageId);
    const vectorId = `${config.projectId}__${safePath}__baseline`;

    const embedResult = await env.AI.run("@cf/baai/bge-large-en-v1.5", {
      text: [crawlResult.screenshotBase64],
    }) as { data: number[][] };
    const vector = embedResult.data[0];

    await env.SCREENSHOT_VECTORS.upsert([{
      id: vectorId,
      values: vector,
      metadata: {
        projectId: config.projectId,
        path: page.pageId,
        screenshotKey: crawlResult.screenshotKey,
        isBaseline: true,
      },
    }]);

    await env.DB.prepare(
      `INSERT INTO pages (id, project_id, url, path, baseline_screenshot_r2_key, baseline_vector_id, baseline_set_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, path) DO UPDATE SET
         baseline_screenshot_r2_key=excluded.baseline_screenshot_r2_key,
         baseline_vector_id=excluded.baseline_vector_id,
         baseline_set_at=excluded.baseline_set_at`
    ).bind(
      crypto.randomUUID(), config.projectId, crawlResult.url, page.pageId,
      crawlResult.screenshotKey, vectorId, Date.now()
    ).run();
  }
}

export async function promoteToBaseline(
  findingId: string,
  env: Env
): Promise<void> {
  const finding = await env.DB.prepare(
    "SELECT * FROM findings WHERE id = ?"
  ).bind(findingId).first<{
    page_id: string; screenshot_r2_key: string | null; run_id: string;
  }>();
  if (!finding || !finding.screenshot_r2_key) return;

  const page = await env.DB.prepare(
    "SELECT * FROM pages WHERE id = ?"
  ).bind(finding.page_id).first<{
    id: string; project_id: string; path: string; url: string;
  }>();
  if (!page) return;

  // Fetch screenshot from R2 and re-embed for the baseline vector
  const obj = await env.SCREENSHOTS.get(finding.screenshot_r2_key);
  if (!obj) return;

  const buf = await obj.arrayBuffer();
  const base64 = Buffer.from(buf).toString("base64");

  const embedResult = await env.AI.run("@cf/baai/bge-large-en-v1.5", {
    text: [base64],
  }) as { data: number[][] };
  const vector = embedResult.data[0];

  const safePath = page.path.replace(/\//g, "_").replace(/^_/, "") || "root";
  const vectorId = `${page.project_id}__${safePath}__baseline`;

  await env.SCREENSHOT_VECTORS.upsert([{
    id: vectorId,
    values: vector,
    metadata: {
      projectId: page.project_id,
      path: page.path,
      screenshotKey: finding.screenshot_r2_key,
      isBaseline: true,
    },
  }]);

  await env.DB.prepare(
    `UPDATE pages SET baseline_screenshot_r2_key=?, baseline_vector_id=?, baseline_set_at=? WHERE id=?`
  ).bind(finding.screenshot_r2_key, vectorId, Date.now(), page.id).run();
}
