import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Finding } from "../lib/api";
import DiffViewer from "./DiffViewer";

interface Props {
  finding: Finding;
  runId: string;
  onReviewed?: () => void;
}

const sevClass: Record<string, string> = {
  critical: "sev-critical",
  major:    "sev-major",
  minor:    "sev-minor",
  info:     "sev-info",
};

const sevChip: Record<string, string> = {
  critical: "sev-chip sev-chip-critical",
  major:    "sev-chip sev-chip-major",
  minor:    "sev-chip sev-chip-minor",
  info:     "sev-chip sev-chip-info",
};

export default function FindingCard({ finding, runId, onReviewed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const navigate = useNavigate();

  async function handleReview(action: "approved" | "rejected") {
    const apiKey = prompt("Reviewer API key:");
    if (!apiKey) return;
    setReviewing(true);
    try {
      await api.findings.review(finding.id, action, apiKey);
      onReviewed?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  }

  const diffPct = finding.diff_score != null ? (finding.diff_score * 100).toFixed(1) : null;
  const sc = sevClass[finding.severity] ?? sevClass.info;
  const chip = sevChip[finding.severity] ?? sevChip.info;

  return (
    <div className={`finding-row anim-fade-up ${sc}`} style={{ alignItems: "flex-start" }}>
      <span className="sev-bar" />

      <div className="finding-row-body">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
          <span className={chip}>{finding.severity}</span>
          {finding.reviewer_action && (
            <span className={`reviewed-badge ${finding.reviewer_action === "approved" ? "reviewed-approved" : "reviewed-rejected"}`}>
              {finding.reviewer_action === "approved" ? "✓ approved" : "✕ rejected"}
            </span>
          )}
        </div>

        <p className="finding-row-desc">{finding.description}</p>

        <div className="finding-row-meta">
          <span className="finding-row-path">{finding.page_id}</span>
          {diffPct && (
            <span className="finding-row-score">{diffPct}% drift</span>
          )}
          {finding.wcag_criterion && (
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--cyan)" }}>
              {finding.wcag_criterion}
            </span>
          )}
        </div>

        <div className="finding-row-actions">
          {finding.finding_type === "visual_drift" && finding.screenshot_r2_key && (
            <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(!expanded)}>
              {expanded ? "Hide diff" : "View diff"}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/runs/${runId}/findings/${finding.id}`)}>
            Live view
          </button>
          {!finding.reviewer_action && (
            <>
              <button className="btn btn-success btn-sm" disabled={reviewing} onClick={() => handleReview("approved")}>
                Approve
              </button>
              <button className="btn btn-danger btn-sm" disabled={reviewing} onClick={() => handleReview("rejected")}>
                Reject
              </button>
            </>
          )}
        </div>

        {expanded && finding.screenshot_r2_key && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            <DiffViewer
              currentKey={finding.screenshot_r2_key}
              baselineKey={finding.baseline_r2_key}
              diffScore={finding.diff_score ?? 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}
