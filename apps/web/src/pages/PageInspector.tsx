import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import DiffViewer from "../components/DiffViewer";
import LiveView from "../components/LiveView";
import { api } from "../lib/api";

const sevChip: Record<string, string> = {
  critical: "sev-chip sev-chip-critical",
  major:    "sev-chip sev-chip-major",
  minor:    "sev-chip sev-chip-minor",
  info:     "sev-chip sev-chip-info",
};

export default function PageInspector() {
  const { runId, findingId } = useParams<{ runId: string; findingId: string }>();

  const { data: run, isLoading } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.runs.get(runId!),
    enabled: !!runId,
  });

  const finding = run?.findings.find(f => f.id === findingId);

  if (isLoading) return <div className="spinner-screen"><div className="spinner" /></div>;
  if (!finding) return (
    <div className="spinner-screen" style={{ color: "var(--red)", fontSize: 13 }}>Finding not found.</div>
  );

  const chip = sevChip[finding.severity] ?? sevChip.info;
  const typeLabel = finding.finding_type === "visual_drift" ? "Visual Drift" : "Accessibility";

  return (
    <div className="page-wrap" style={{ maxWidth: 1100 }}>
      <nav className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to={`/runs/${runId}`}>Run {runId!.slice(0, 8)}…</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Finding {findingId!.slice(0, 8)}…</span>
      </nav>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span className={chip}>{finding.severity}</span>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.08em", textTransform: "uppercase" as const,
            color: finding.finding_type === "visual_drift" ? "var(--accent)" : "var(--cyan)",
            background: finding.finding_type === "visual_drift" ? "var(--accent-s)" : "var(--cyan-s)",
            padding: "2px 8px", borderRadius: 3,
          }}>
            {typeLabel}
          </span>
          {finding.wcag_criterion && (
            <span style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
              color: "var(--cyan)", background: "var(--cyan-s)",
              padding: "2px 8px", borderRadius: 3, border: "1px solid rgba(34,211,238,0.15)",
            }}>
              {finding.wcag_criterion}
            </span>
          )}
        </div>

        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)", lineHeight: 1.4, marginBottom: 8 }}>
          {finding.description}
        </p>

        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-3)" }}>
            {finding.page_id}
          </span>
          {finding.diff_score != null && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-2)" }}>
              {(finding.diff_score * 100).toFixed(1)}% drift · cosine {finding.diff_score.toFixed(4)}
            </span>
          )}
          {finding.reviewer_action && (
            <span className={`reviewed-badge ${finding.reviewer_action === "approved" ? "reviewed-approved" : "reviewed-rejected"}`}>
              {finding.reviewer_action === "approved" ? "✓ approved" : "✕ rejected"}
            </span>
          )}
        </div>
      </div>

      <div className="divider" />

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Visual diff */}
        <div>
          <p style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const,
            color: "var(--text-3)", marginBottom: 12,
          }}>
            Visual Diff
          </p>
          {finding.screenshot_r2_key ? (
            <DiffViewer
              currentKey={finding.screenshot_r2_key}
              baselineKey={finding.baseline_r2_key}
              diffScore={finding.diff_score ?? 0}
            />
          ) : (
            <div className="empty-state" style={{ minHeight: 240 }}>
              <p className="empty-state-title">No screenshot</p>
              <p className="empty-state-sub">This finding has no screenshot attached</p>
            </div>
          )}
        </div>

        {/* Live view */}
        <div>
          <p style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" as const,
            color: "var(--text-3)", marginBottom: 12,
          }}>
            Live View
          </p>
          <LiveView findingId={findingId!} pageUrl="" />
        </div>
      </div>
    </div>
  );
}
