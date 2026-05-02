import type { Env } from "../types";

export interface Project {
  id: string;
  name: string;
  base_url: string;
  alert_email: string | null;
  cron_schedule: string | null;
  max_pages: number;
  viewport_width: number;
  viewport_height: number;
  created_at: number;
  last_run_at: number | null;
}

export interface Run {
  id: string;
  project_id: string;
  triggered_by: string;
  status: string;
  pages_crawled: number;
  findings_count: number;
  drift_count: number;
  a11y_count: number;
  started_at: number;
  completed_at: number | null;
  error_message: string | null;
}

export interface Page {
  id: string;
  project_id: string;
  url: string;
  path: string;
  baseline_screenshot_r2_key: string | null;
  baseline_vector_id: string | null;
  baseline_set_at: number | null;
}

export interface Finding {
  id: string;
  run_id: string;
  page_id: string;
  finding_type: string;
  severity: string;
  description: string;
  screenshot_r2_key: string | null;
  baseline_r2_key: string | null;
  diff_score: number | null;
  wcag_criterion: string | null;
  live_view_session_id: string | null;
  reviewer_action: string | null;
  reviewed_at: number | null;
}

export async function getProject(env: Env, id: string): Promise<Project | null> {
  return env.DB.prepare("SELECT * FROM projects WHERE id = ?").bind(id).first<Project>();
}

export async function listProjects(env: Env): Promise<Project[]> {
  const result = await env.DB.prepare(
    "SELECT p.*, (SELECT findings_count FROM runs WHERE project_id = p.id ORDER BY started_at DESC LIMIT 1) as last_findings_count FROM projects p ORDER BY created_at DESC"
  ).all<Project>();
  return result.results;
}

export async function createProject(env: Env, project: Omit<Project, "last_run_at">): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO projects (id, name, base_url, alert_email, cron_schedule, max_pages, viewport_width, viewport_height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    project.id, project.name, project.base_url, project.alert_email,
    project.cron_schedule, project.max_pages, project.viewport_width,
    project.viewport_height, project.created_at
  ).run();
}

export async function listRunsForProject(env: Env, projectId: string, limit = 10): Promise<Run[]> {
  const result = await env.DB.prepare(
    "SELECT * FROM runs WHERE project_id = ? ORDER BY started_at DESC LIMIT ?"
  ).bind(projectId, limit).all<Run>();
  return result.results;
}

export async function getRun(env: Env, id: string): Promise<Run | null> {
  return env.DB.prepare("SELECT * FROM runs WHERE id = ?").bind(id).first<Run>();
}

export async function createRun(env: Env, run: Omit<Run, "pages_crawled" | "findings_count" | "drift_count" | "a11y_count" | "completed_at" | "error_message">): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO runs (id, project_id, triggered_by, status, started_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(run.id, run.project_id, run.triggered_by, run.status, run.started_at).run();
}

export async function getFindingsForRun(
  env: Env,
  runId: string,
  opts: { type?: string; severity?: string; page?: number; limit?: number } = {}
): Promise<Finding[]> {
  const limit = opts.limit ?? 20;
  const offset = ((opts.page ?? 1) - 1) * limit;

  let query = "SELECT * FROM findings WHERE run_id = ?";
  const binds: unknown[] = [runId];

  if (opts.type) {
    query += " AND finding_type = ?";
    binds.push(opts.type);
  }
  if (opts.severity) {
    query += " AND severity = ?";
    binds.push(opts.severity);
  }

  query += " ORDER BY severity DESC LIMIT ? OFFSET ?";
  binds.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...binds).all<Finding>();
  return result.results;
}

export async function getFinding(env: Env, id: string): Promise<Finding | null> {
  return env.DB.prepare("SELECT * FROM findings WHERE id = ?").bind(id).first<Finding>();
}

export async function getPageForProject(env: Env, projectId: string, path: string): Promise<Page | null> {
  return env.DB.prepare(
    "SELECT * FROM pages WHERE project_id = ? AND path = ?"
  ).bind(projectId, path).first<Page>();
}

export async function getWebhookForProject(env: Env, projectId: string): Promise<{ secret: string } | null> {
  return env.DB.prepare(
    "SELECT secret FROM webhooks WHERE project_id = ? LIMIT 1"
  ).bind(projectId).first<{ secret: string }>();
}

export async function getProjectsWithDueCron(env: Env, hour: number, minute: number, dow: number): Promise<Project[]> {
  // Fetch all projects with a cron_schedule and filter in-process
  // (Cloudflare D1 doesn't support cron parsing in SQL)
  const result = await env.DB.prepare(
    "SELECT * FROM projects WHERE cron_schedule IS NOT NULL"
  ).all<Project>();

  return result.results.filter(p => isCronDue(p.cron_schedule!, hour, minute, dow));
}

function isCronDue(schedule: string, hour: number, minute: number, dow: number): boolean {
  const [min, hr, , , day] = schedule.split(" ");
  const matchMin = min === "*" || Number(min) === minute;
  const matchHr = hr === "*" || Number(hr) === hour;
  const matchDow = day === "*" || day.split(",").includes(String(dow)) ||
    (day.includes("-") && (() => {
      const [start, end] = day.split("-").map(Number);
      return dow >= start && dow <= end;
    })());
  return matchMin && matchHr && matchDow;
}
