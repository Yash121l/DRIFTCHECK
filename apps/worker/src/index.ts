import { Hono } from "hono";
import { z } from "zod";
import puppeteer from "@cloudflare/puppeteer";
import { promoteToBaseline } from "./differ";
import { getFinding, getFindingsForRun, getRun, getWebhookForProject, listProjects, listRunsForProject, createProject, createRun, getProject } from "./db/queries";
import type { Env } from "./types";
import { isUUID, isCronDue } from "./utils";
import { CrawlWorkflow } from "./workflows/crawl";

export { CrawlWorkflow };

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url().refine((u) => u.startsWith("https://"), "Must be HTTPS"),
  alertEmail: z.string().email().optional(),
  cronSchedule: z.string().optional(),
  maxPages: z.number().int().min(1).max(100).optional().default(50),
  viewportWidth: z.number().int().optional().default(1440),
  viewportHeight: z.number().int().optional().default(900),
});

const TriggerRunSchema = z.object({
  triggeredBy: z.enum(["manual", "cron", "webhook"]),
});

const ReviewSchema = z.object({
  action: z.enum(["approved", "rejected"]),
});

const app = new Hono<{ Bindings: Env }>();

// ── Auth middleware for review endpoints ──────────────────────────────────────
// ── Projects ──────────────────────────────────────────────────────────────────
app.post("/api/projects", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const d = parsed.data;
  const id = crypto.randomUUID();
  await createProject(c.env, {
    id,
    name: d.name,
    base_url: d.baseUrl,
    alert_email: d.alertEmail ?? null,
    cron_schedule: d.cronSchedule ?? null,
    max_pages: d.maxPages,
    viewport_width: d.viewportWidth,
    viewport_height: d.viewportHeight,
    created_at: Date.now(),
  });

  const project = await getProject(c.env, id);
  return c.json(project, 201);
});

app.get("/api/projects", async (c) => {
  const projects = await listProjects(c.env);
  return c.json(projects);
});

app.get("/api/projects/:id", async (c) => {
  const { id } = c.req.param();
  if (!isUUID(id)) return c.json({ error: "Invalid project ID" }, 400);

  const project = await getProject(c.env, id);
  if (!project) return c.json({ error: "Not found" }, 404);

  const runs = await listRunsForProject(c.env, id, 10);
  return c.json({ ...project, runs });
});

// ── Runs ──────────────────────────────────────────────────────────────────────
app.post("/api/projects/:id/runs", async (c) => {
  const { id: projectId } = c.req.param();
  if (!isUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = TriggerRunSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const project = await getProject(c.env, projectId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const runId = crypto.randomUUID();
  await createRun(c.env, {
    id: runId,
    project_id: projectId,
    triggered_by: parsed.data.triggeredBy,
    status: "pending",
    started_at: Date.now(),
  });

  const workflow = await c.env.CRAWL_WORKFLOW.create({
    params: {
      projectId,
      runId,
      baseUrl: project.base_url,
      maxPages: Math.min(project.max_pages, 100),
      viewportWidth: project.viewport_width,
      viewportHeight: project.viewport_height,
    },
  });

  return c.json({ runId, workflowId: workflow.id }, 202);
});

app.get("/api/runs/:runId", async (c) => {
  const { runId } = c.req.param();
  if (!isUUID(runId)) return c.json({ error: "Invalid run ID" }, 400);

  const run = await getRun(c.env, runId);
  if (!run) return c.json({ error: "Not found" }, 404);

  const findings = await getFindingsForRun(c.env, runId);
  return c.json({ ...run, findings });
});

app.get("/api/runs/:runId/findings", async (c) => {
  const { runId } = c.req.param();
  if (!isUUID(runId)) return c.json({ error: "Invalid run ID" }, 400);

  const url = new URL(c.req.url);
  const type = url.searchParams.get("type") ?? undefined;
  const severity = url.searchParams.get("severity") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");

  const findings = await getFindingsForRun(c.env, runId, { type, severity, page });
  return c.json(findings);
});

// ── Findings / Review ─────────────────────────────────────────────────────────
app.post("/api/findings/:findingId/review", async (c) => {
  // Inline auth check for review endpoint
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
  const token = auth.slice(7);
  const stored = await c.env.API_KEYS.get("reviewer");
  if (!stored || stored !== token) return c.json({ error: "Forbidden" }, 403);

  const { findingId } = c.req.param();
  if (!isUUID(findingId)) return c.json({ error: "Invalid finding ID" }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const finding = await getFinding(c.env, findingId);
  if (!finding) return c.json({ error: "Not found" }, 404);

  if (parsed.data.action === "approved" && finding.finding_type === "visual_drift") {
    await promoteToBaseline(findingId, c.env);
  }

  await c.env.DB.prepare(
    "UPDATE findings SET reviewer_action=?, reviewed_at=? WHERE id=?"
  ).bind(parsed.data.action, Date.now(), findingId).run();

  return c.json({ ok: true });
});

// ── Live View ─────────────────────────────────────────────────────────────────
app.post("/api/findings/:findingId/live-view", async (c) => {
  const { findingId } = c.req.param();
  if (!isUUID(findingId)) return c.json({ error: "Invalid finding ID" }, 400);

  const finding = await getFinding(c.env, findingId);
  if (!finding) return c.json({ error: "Not found" }, 404);

  const page_ = await c.env.DB.prepare(
    "SELECT url FROM pages WHERE id = ?"
  ).bind(finding.page_id).first<{ url: string }>();
  if (!page_) return c.json({ error: "Page not found" }, 404);

  // Launch a keep-alive Browser Run session for live inspection
  const session = await puppeteer.launch(c.env.BROWSER, {
    keep_alive: 60000,
  });
  const page = await session.newPage();
  await page.goto(page_.url, { waitUntil: "networkidle0", timeout: 20000 });

  // reason: Browser Run exposes session ID for constructing the Live View URL
  const sessionId = session.sessionId();

  await c.env.DB.prepare(
    "UPDATE findings SET live_view_session_id=? WHERE id=?"
  ).bind(sessionId, findingId).run();

  return c.json({
    sessionId,
    liveViewUrl: `https://browser.render.cloudflare.com/session/${sessionId}/live`,
    pageUrl: page_.url,
  });
});

// ── Signed screenshot URL ─────────────────────────────────────────────────────
app.get("/api/screenshots/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const obj = await c.env.SCREENSHOTS.get(key);
  if (!obj) return c.json({ error: "Not found" }, 404);
  // reason: stream through worker rather than expose raw R2 — no public bucket needed
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType ?? "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

// ── Webhooks ──────────────────────────────────────────────────────────────────
app.post("/api/webhooks/:projectId", async (c) => {
  const { projectId } = c.req.param();
  if (!isUUID(projectId)) return c.json({ error: "Invalid project ID" }, 400);

  const webhook = await getWebhookForProject(c.env, projectId);
  if (!webhook) return c.json({ error: "Webhook not configured" }, 404);

  // Validate HMAC-SHA256 signature (timing-safe)
  const signature = c.req.header("X-Hub-Signature-256")?.replace("sha256=", "");
  if (!signature) return c.json({ error: "Missing signature" }, 401);

  const rawBody = await c.req.arrayBuffer();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhook.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const sigBytes = hexToBytes(signature);
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, rawBody);
  if (!valid) return c.json({ error: "Invalid signature" }, 401);

  const project = await getProject(c.env, projectId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const runId = crypto.randomUUID();
  await createRun(c.env, {
    id: runId,
    project_id: projectId,
    triggered_by: "webhook",
    status: "pending",
    started_at: Date.now(),
  });

  await c.env.CRAWL_WORKFLOW.create({
    params: {
      projectId,
      runId,
      baseUrl: project.base_url,
      maxPages: Math.min(project.max_pages, 100),
      viewportWidth: project.viewport_width,
      viewportHeight: project.viewport_height,
    },
  });

  return c.json({ runId }, 202);
});

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ── Cron handler ──────────────────────────────────────────────────────────────
async function handleCron(env: Env): Promise<void> {
  const now = new Date();
  const projects = await env.DB.prepare(
    "SELECT * FROM projects WHERE cron_schedule IS NOT NULL"
  ).all<{ id: string; base_url: string; max_pages: number; viewport_width: number; viewport_height: number; cron_schedule: string }>();

  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const dow = now.getUTCDay(); // 0=Sunday

  for (const project of projects.results) {
    if (!isCronDue(project.cron_schedule, hour, minute, dow)) continue;

    const runId = crypto.randomUUID();
    await createRun(env, {
      id: runId,
      project_id: project.id,
      triggered_by: "cron",
      status: "pending",
      started_at: Date.now(),
    });

    await env.CRAWL_WORKFLOW.create({
      params: {
        projectId: project.id,
        runId,
        baseUrl: project.base_url,
        maxPages: Math.min(project.max_pages, 100),
        viewportWidth: project.viewport_width,
        viewportHeight: project.viewport_height,
      },
    });
  }
}

// ── Worker export ─────────────────────────────────────────────────────────────
export { app };

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await handleCron(env);
  },
};
