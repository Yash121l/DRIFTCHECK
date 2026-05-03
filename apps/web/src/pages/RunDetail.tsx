import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import A11yReport from "../components/A11yReport";
import FindingCard from "../components/FindingCard";
import RunStatusBadge from "../components/RunStatusBadge";
import { useRun, useRunFindings } from "../hooks/useRun";

type Tab = "visual" | "a11y" | "all";

function fmt(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const [tab, setTab] = useState<Tab>("visual");
  const [severity, setSeverity] = useState("");
  const queryClient = useQueryClient();

  const { data: run, isLoading, error } = useRun(runId!);
  const { data: findings = [] } = useRunFindings(runId!, {
    type: tab === "visual" ? "visual_drift" : tab === "a11y" ? "accessibility" : undefined,
    severity: severity || undefined,
  });

  if (isLoading) return <div className="spinner-screen"><div className="spinner" /></div>;
  if (error || !run) return (
    <div className="spinner-screen" style={{ color: "var(--red)", fontSize: 13 }}>
      {(error as Error)?.message ?? "Not found"}
    </div>
  );

  const duration = run.completed_at
    ? Math.round((run.completed_at - run.started_at) / 1000)
    : null;

  return (
    <div className="page-wrap">
      <nav className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to={`/projects/${run.project_id}`}>{run.project_id.slice(0, 8)}…</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Run {runId!.slice(0, 8)}…</span>
      </nav>

      {/* Run header */}
      <div className="page-header" style={{ alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 className="page-title" style={{ fontSize: 18 }}>Run Report</h1>
          <RunStatusBadge status={run.status} />
        </div>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-3)" }}>
          {fmt(run.started_at)}
          {" · "}{run.triggered_by}
          {duration !== null && ` · ${duration}s`}
        </p>
      </div>

      {run.error_message && (
        <div className="error-banner" style={{ marginBottom: 20 }}>{run.error_message}</div>
      )}

      {/* Stat row */}
      <div className="stat-row">
        <div className="stat-cell">
          <span className="stat-value">{run.pages_crawled}</span>
          <span className="stat-label">Pages</span>
        </div>
        <div className="stat-cell">
          <span className="stat-value" style={{ color: run.drift_count > 0 ? "var(--accent)" : "var(--text-1)" }}>
            {run.drift_count}
          </span>
          <span className="stat-label">Drift</span>
        </div>
        <div className="stat-cell">
          <span className="stat-value" style={{ color: run.a11y_count > 0 ? "var(--yellow)" : "var(--text-1)" }}>
            {run.a11y_count}
          </span>
          <span className="stat-label">A11y</span>
        </div>
        <div className="stat-cell">
          <span className="stat-value" style={{ color: run.findings_count > 0 ? "var(--red)" : "var(--text-1)" }}>
            {run.findings_count}
          </span>
          <span className="stat-label">Total</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {(["visual", "a11y", "all"] as Tab[]).map(t => (
          <button
            key={t}
            className={`tab-btn${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "visual" ? "Visual Drift" : t === "a11y" ? "Accessibility" : "All Findings"}
            <span className="tab-count">
              {t === "visual" ? run.drift_count : t === "a11y" ? run.a11y_count : run.findings_count}
            </span>
          </button>
        ))}

        <div style={{ marginLeft: "auto", paddingBottom: 1 }}>
          <select
            className="dc-select"
            value={severity}
            onChange={e => setSeverity(e.target.value)}
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {tab === "a11y" ? (
        <A11yReport findings={findings} />
      ) : (
        <div className="stagger" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {findings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
                  <path d="M2 8a6 6 0 1112 0A6 6 0 012 8z" />
                  <path d="M8 5v4M8 10.5v.5" />
                </svg>
              </div>
              <p className="empty-state-title">No findings</p>
              <p className="empty-state-sub">No {tab === "visual" ? "visual drift" : "issues"} detected for this filter</p>
            </div>
          ) : (
            findings.map(f => (
              <FindingCard
                key={f.id}
                finding={f}
                runId={runId!}
                onReviewed={() => queryClient.invalidateQueries({ queryKey: ["run-findings", runId] })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
