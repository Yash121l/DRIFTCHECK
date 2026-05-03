import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import RunStatusBadge from "../components/RunStatusBadge";
import { useProject } from "../hooks/useProject";
import { api } from "../lib/api";

function dur(s: number, e: number | null): string {
  if (!e) return "—";
  const d = Math.round((e - s) / 1000);
  return d < 60 ? `${d}s` : `${Math.floor(d / 60)}m ${d % 60}s`;
}

function fmt(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, error } = useProject(projectId!);
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: () => api.runs.create(projectId!, "manual"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  if (isLoading) return <div className="spinner-screen"><div className="spinner" /></div>;
  if (error || !data) return (
    <div className="spinner-screen" style={{ color: "var(--red)", fontSize: 13 }}>
      {(error as Error)?.message ?? "Not found"}
    </div>
  );

  return (
    <div className="page-wrap">
      <nav className="breadcrumb">
        <Link to="/">Projects</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{data.name}</span>
      </nav>

      <div className="page-header">
        <div>
          <h1 className="page-title">{data.name}</h1>
          <a href={data.base_url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--text-2)", marginTop: 4, display: "block" }}>
            {data.base_url}
          </a>
        </div>
        <button
          className="btn btn-primary"
          disabled={runMutation.isPending}
          onClick={() => runMutation.mutate()}
        >
          {runMutation.isPending ? "Starting…" : "Run Now"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)" }}>
          Run History
        </p>
        <p className="truncate-id">{data.runs.length} run{data.runs.length !== 1 ? "s" : ""}</p>
      </div>

      {data.runs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
              <polygon points="4,2 14,8 4,14" />
            </svg>
          </div>
          <p className="empty-state-title">No runs yet</p>
          <p className="empty-state-sub">Click Run Now to start the first crawl</p>
        </div>
      ) : (
        <table className="dc-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Started</th>
              <th>Trigger</th>
              <th>Pages</th>
              <th>Drift</th>
              <th>A11y</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.runs.map(run => (
              <tr key={run.id} style={{ cursor: "pointer" }} onClick={() => window.location.href = `/runs/${run.id}`}>
                <td><RunStatusBadge status={run.status} /></td>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{fmt(run.started_at)}</td>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {run.triggered_by}
                </td>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>{run.pages_crawled}</td>
                <td>
                  {run.drift_count > 0
                    ? <span className="sev-chip sev-chip-major">{run.drift_count}</span>
                    : <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-3)" }}>0</span>}
                </td>
                <td>
                  {run.a11y_count > 0
                    ? <span className="sev-chip sev-chip-minor">{run.a11y_count}</span>
                    : <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-3)" }}>0</span>}
                </td>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-3)" }}>
                  {dur(run.started_at, run.completed_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
