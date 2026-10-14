export interface CrawlConfig {
  projectId: string;
  runId: string;
  baseUrl: string;
  maxPages: number;
  viewportWidth: number;
  viewportHeight: number;
  /** For analytics only; older queued runs may not carry it. */
  triggeredBy?: "manual" | "cron" | "webhook";
}

export interface PageCrawlResult {
  url: string;
  path: string;
  screenshotKey: string;
  screenshotBase64: string;
  loadTimeMs: number;
  statusCode: number;
  title: string;
}

export interface DiffResult {
  pageId: string;
  url: string;
  diffScore: number;
  isDrift: boolean;
  currentKey: string;
  baselineKey: string | null;
  isNewPage: boolean;
}

export interface A11yFinding {
  wcagCriterion: string;
  description: string;
  severity: "critical" | "major" | "minor" | "info";
  elementSelector?: string;
  suggestedFix: string;
}

export interface A11yResult {
  url: string;
  findings: A11yFinding[];
  overallScore: number;
}

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface Env {
  // Bindings
  BROWSER: Fetcher;
  AI: Ai;
  DB: D1Database;
  SCREENSHOTS: R2Bucket;
  SCREENSHOT_VECTORS: VectorizeIndex;
  CRAWL_WORKFLOW: Workflow;
  EMAIL: SendEmail;
  API_KEYS: KVNamespace;
  // Vars
  BASE_URL: string;
  /** PostHog public project key; unset turns analytics off. */
  POSTHOG_KEY?: string;
}

export const FindingType = {
  VISUAL_DRIFT: "visual_drift",
  ACCESSIBILITY: "accessibility",
} as const;
export type FindingType = (typeof FindingType)[keyof typeof FindingType];

export const Severity = {
  CRITICAL: "critical",
  MAJOR: "major",
  MINOR: "minor",
  INFO: "info",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const RunStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const TriggeredBy = {
  MANUAL: "manual",
  CRON: "cron",
  WEBHOOK: "webhook",
} as const;
export type TriggeredBy = (typeof TriggeredBy)[keyof typeof TriggeredBy];

export const ReviewerAction = {
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;
export type ReviewerAction = (typeof ReviewerAction)[keyof typeof ReviewerAction];
