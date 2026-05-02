import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Finding } from "../lib/api";
import DiffViewer from "./DiffViewer";

interface Props {
  finding: Finding;
  runId: string;
  onReviewed?: () => void;
}

const severityConfig = {
  critical: { label: "Critical", classes: "bg-red-900/60 text-red-300 border-red-800" },
  major: { label: "Major", classes: "bg-orange-900/60 text-orange-300 border-orange-800" },
  minor: { label: "Minor", classes: "bg-yellow-900/60 text-yellow-300 border-yellow-800" },
  info: { label: "Info", classes: "bg-gray-700 text-gray-400 border-gray-600" },
} as const;

export default function FindingCard({ finding, runId, onReviewed }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const navigate = useNavigate();

  const sev = severityConfig[finding.severity as keyof typeof severityConfig] ?? severityConfig.info;

  async function handleReview(action: "approved" | "rejected") {
    const apiKey = prompt("Enter reviewer API key:");
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

  const pagesPath = finding.page_id;
  const diffPct = finding.diff_score != null ? (finding.diff_score * 100).toFixed(1) : null;

  return (
    <div className={`rounded-lg border ${sev.classes} bg-gray-900 overflow-hidden`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${sev.classes} flex-shrink-0`}>
          {sev.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-200 leading-snug">{finding.description}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{pagesPath}</p>
          {diffPct && (
            <p className="text-xs text-gray-500 mt-0.5">{diffPct}% drift from baseline</p>
          )}
        </div>

        {/* Reviewer action badge */}
        {finding.reviewer_action && (
          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${finding.reviewer_action === "approved" ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>
            {finding.reviewer_action}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 px-4 pb-3">
        {finding.finding_type === "visual_drift" && finding.screenshot_r2_key && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            {expanded ? "Hide Diff" : "View Diff"}
          </button>
        )}
        <button
          onClick={() => navigate(`/runs/${runId}/findings/${finding.id}`)}
          className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
        >
          Open Live View
        </button>
        {!finding.reviewer_action && (
          <>
            <button
              disabled={reviewing}
              onClick={() => handleReview("approved")}
              className="text-xs px-3 py-1.5 rounded bg-green-800 hover:bg-green-700 text-green-200 transition-colors disabled:opacity-50"
            >
              Approve as Baseline
            </button>
            <button
              disabled={reviewing}
              onClick={() => handleReview("rejected")}
              className="text-xs px-3 py-1.5 rounded bg-red-800 hover:bg-red-700 text-red-200 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </>
        )}
      </div>

      {/* Diff Viewer */}
      {expanded && finding.screenshot_r2_key && (
        <div className="border-t border-gray-700 px-4 py-4">
          <DiffViewer
            currentKey={finding.screenshot_r2_key}
            baselineKey={finding.baseline_r2_key}
            diffScore={finding.diff_score ?? 0}
          />
        </div>
      )}
    </div>
  );
}
