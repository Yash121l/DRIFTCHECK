CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  alert_email TEXT,
  cron_schedule TEXT,
  max_pages INTEGER DEFAULT 50,
  viewport_width INTEGER DEFAULT 1440,
  viewport_height INTEGER DEFAULT 900,
  created_at INTEGER NOT NULL,
  last_run_at INTEGER
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('manual', 'cron', 'webhook')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  pages_crawled INTEGER DEFAULT 0,
  findings_count INTEGER DEFAULT 0,
  drift_count INTEGER DEFAULT 0,
  a11y_count INTEGER DEFAULT 0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_project ON runs (project_id);

CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  baseline_screenshot_r2_key TEXT,
  baseline_vector_id TEXT,
  baseline_set_at INTEGER,
  UNIQUE(project_id, path)
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id),
  page_id TEXT NOT NULL REFERENCES pages(id),
  finding_type TEXT NOT NULL CHECK (finding_type IN ('visual_drift', 'accessibility')),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'major', 'minor', 'info')),
  description TEXT NOT NULL,
  screenshot_r2_key TEXT,
  baseline_r2_key TEXT,
  diff_score REAL,
  wcag_criterion TEXT,
  live_view_session_id TEXT,
  reviewer_action TEXT,
  reviewed_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_findings_run ON findings (run_id);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  secret TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
