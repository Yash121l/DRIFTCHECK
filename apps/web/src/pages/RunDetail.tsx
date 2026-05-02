import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import A11yReport from "../components/A11yReport";
import FindingCard from "../components/FindingCard";
import RunStatusBadge from "../components/RunStatusBadge";
import { useRun, useRunFindings } from "../hooks/useRun";

type Tab = "visual" | "a11y" | "all";

export default function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const [tab, setTab] = useState<Tab>("visual");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: run, isLoading, error } = useRun(runId!);
  const { data: findings = [] } = useRunFindings(runId!, {
    type: tab === "visual" ? "visual_drift" : tab === "a11y" ? "accessibility" : undefined,
    severity: severityFilter || undefined,
  });

  if (isLoading) return <Spinner />;
  if (error || !run) return <p className="p-8 text-red-400">{(error as Error)?.message ?? "Not found"}</p>;

  const duration =
    run.completed_at && run.started_at
      ? Math.round((run.completed_at - run.started_at) / 1000)
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-300">Projects</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-300 font-mono">{run.project_id.slice(0, 8)}…</span>
        <span className="mx-2">/</span>
        <span className="text-gray-400">Run {runId!.slice(0, 8)}…</span>
      </nav>

      {/* Run header */}
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Run Report</h1>
            <RunStatusBadge status={run.status} />
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Triggered by {run.triggered_by} · {new Date(run.started_at).toLocaleString()}
            {duration && ` · ${duration}s`}
          </p>
        </div>

        <div className="flex gap-4 text-center">
          <Stat label="Pages" value={run.pages_crawled} />
          <Stat label="Drift" value={run.drift_count} accent="text-orange-400" />
          <Stat label="A11y" value={run.a11y_count} accent="text-purple-400" />
          <Stat label="Total" value={run.findings_count} accent="text-red-400" />
        </div>
      </div>

      {run.error_message && (
        <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-red-300 text-sm">
          {run.error_message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-700">
        {(["visual", "a11y", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "visual" ? "Visual Drift" : t === "a11y" ? "Accessibility" : "All Findings"}
          </button>
        ))}

        <div className="ml-auto pb-1">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      {/* Tab content */}
      {tab === "a11y" ? (
        <A11yReport findings={findings} />
      ) : (
        <div className="space-y-3">
          {findings.length === 0 ? (
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-8 text-center text-gray-500 text-sm">
              No findings for this filter.
            </div>
          ) : (
            findings.map((f) => (
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

function Stat({ label, value, accent = "text-white" }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <p className={`text-lg font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
