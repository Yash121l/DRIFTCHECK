import type { CrawlConfig, Env } from "./types";

export async function sendAlertEmail(
  config: CrawlConfig,
  findingsCount: number,
  env: Env
): Promise<void> {
  const project = await env.DB.prepare(
    "SELECT * FROM projects WHERE id = ?"
  ).bind(config.projectId).first<{ name: string; base_url: string; alert_email: string | null }>();

  if (!project?.alert_email) return;

  const findings = await env.DB.prepare(
    "SELECT * FROM findings WHERE run_id = ? ORDER BY severity DESC LIMIT 20"
  ).bind(config.runId).all<{ severity: string }>();

  const criticalCount = findings.results.filter((f) => f.severity === "critical").length;
  const subject = `DriftCheck: ${findingsCount} findings on ${project.name} [${criticalCount} critical]`;

  const htmlBody = `
    <h2>DriftCheck Report</h2>
    <p>Project: <strong>${project.name}</strong></p>
    <p>Base URL: <a href="${project.base_url}">${project.base_url}</a></p>
    <p>Run ID: ${config.runId}</p>
    <h3>Summary</h3>
    <ul>
      <li>Total findings: ${findingsCount}</li>
      <li>Critical: ${criticalCount}</li>
    </ul>
    <p><a href="${env.BASE_URL}/runs/${config.runId}">View full report →</a></p>
  `;

  await env.EMAIL.send({
    from: "alerts@driftcheck.example.com",
    to: [project.alert_email],
    subject,
    html: htmlBody,
  });
}
