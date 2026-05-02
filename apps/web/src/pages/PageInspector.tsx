import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import DiffViewer from "../components/DiffViewer";
import LiveView from "../components/LiveView";
import { api } from "../lib/api";

export default function PageInspector() {
  const { runId, findingId } = useParams<{ runId: string; findingId: string }>();

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.runs.get(runId!),
    enabled: !!runId,
  });

  const finding = run?.findings.find((f) => f.id === findingId);

  if (runLoading) return <Spinner />;
  if (!finding) return <p className="p-8 text-red-400">Finding not found.</p>;

  const pageUrl = ""; // We don't store URL directly on finding; live-view endpoint resolves it

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link to="/" className="hover:text-gray-300">Projects</Link>
        <span className="mx-2">/</span>
        <Link to={`/runs/${runId}`} className="hover:text-gray-300">Run {runId!.slice(0, 8)}…</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-400">Finding {findingId!.slice(0, 8)}…</span>
      </nav>

      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-white">Page Inspector</h1>
        <span className={`text-xs px-2.5 py-0.5 rounded-full border ${severityClasses(finding.severity)}`}>
          {finding.severity}
        </span>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-700 text-gray-300">
          {finding.finding_type === "visual_drift" ? "Visual Drift" : "Accessibility"}
        </span>
      </div>

      <p className="text-gray-300 text-sm">{finding.description}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: diff viewer */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Visual Diff</h2>
          {finding.screenshot_r2_key ? (
            <DiffViewer
              currentKey={finding.screenshot_r2_key}
              baselineKey={finding.baseline_r2_key}
              diffScore={finding.diff_score ?? 0}
            />
          ) : (
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-8 text-center text-gray-500 text-sm">
              No screenshot available.
            </div>
          )}
        </div>

        {/* Right: live view */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Live View</h2>
          <LiveView findingId={findingId!} pageUrl={pageUrl} />
        </div>
      </div>

      {/* WCAG criterion detail */}
      {finding.wcag_criterion && (
        <div className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">WCAG Criterion</p>
          <p className="text-sm text-blue-400 font-mono">{finding.wcag_criterion}</p>
        </div>
      )}
    </div>
  );
}

function severityClasses(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-900/60 text-red-300 border-red-800";
    case "major": return "bg-orange-900/60 text-orange-300 border-orange-800";
    case "minor": return "bg-yellow-900/60 text-yellow-300 border-yellow-800";
    default: return "bg-gray-700 text-gray-400 border-gray-600";
  }
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
