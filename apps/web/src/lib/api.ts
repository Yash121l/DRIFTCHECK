import { track } from "./analytics";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

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
  status: "pending" | "running" | "completed" | "failed";
  pages_crawled: number;
  findings_count: number;
  drift_count: number;
  a11y_count: number;
  started_at: number;
  completed_at: number | null;
  error_message: string | null;
}

export interface Finding {
  id: string;
  run_id: string;
  page_id: string;
  finding_type: "visual_drift" | "accessibility";
  severity: "critical" | "major" | "minor" | "info";
  description: string;
  screenshot_r2_key: string | null;
  baseline_r2_key: string | null;
  diff_score: number | null;
  wcag_criterion: string | null;
  live_view_session_id: string | null;
  reviewer_action: "approved" | "rejected" | null;
  reviewed_at: number | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  projects: {
    list: () => request<Project[]>("/projects"),
    get: (id: string) => request<Project & { runs: Run[] }>(`/projects/${id}`),
    create: (data: {
      name: string;
      baseUrl: string;
      alertEmail?: string;
      cronSchedule?: string;
      maxPages?: number;
    }) =>
      request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }).then((p) => {
        track("project_created", {
          project_id: p.id,
          max_pages: p.max_pages,
          has_schedule: !!data.cronSchedule,
          has_alert_email: !!data.alertEmail,
        });
        return p;
      }),
  },

  runs: {
    create: (projectId: string, triggeredBy: "manual" | "cron" | "webhook" = "manual") =>
      request<{ runId: string; workflowId: string }>(`/projects/${projectId}/runs`, {
        method: "POST",
        body: JSON.stringify({ triggeredBy }),
      }).then((r) => {
        track("run_triggered", { project_id: projectId, triggered_by: triggeredBy });
        return r;
      }),
    get: (runId: string) => request<Run & { findings: Finding[] }>(`/runs/${runId}`),
    findings: (
      runId: string,
      opts: { type?: string; severity?: string; page?: number } = {}
    ) => {
      const params = new URLSearchParams();
      if (opts.type) params.set("type", opts.type);
      if (opts.severity) params.set("severity", opts.severity);
      if (opts.page) params.set("page", String(opts.page));
      return request<Finding[]>(`/runs/${runId}/findings?${params}`);
    },
  },

  findings: {
    review: (findingId: string, action: "approved" | "rejected", apiKey: string) =>
      request<{ ok: boolean }>(`/findings/${findingId}/review`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ action }),
      }).then((r) => {
        track("finding_reviewed", { finding_id: findingId, action });
        return r;
      }),
    liveView: (findingId: string) =>
      request<{ sessionId: string; liveViewUrl: string; pageUrl: string }>(
        `/findings/${findingId}/live-view`,
        { method: "POST" }
      ).then((r) => {
        track("live_view_opened", { finding_id: findingId });
        return r;
      }),
    screenshotUrl: (key: string) => `/api/screenshots/${key}`,
  },
};
