import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import RunStatusBadge from "../components/RunStatusBadge";
import { useProject } from "../hooks/useProject";
import { api } from "../lib/api";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, error } = useProject(projectId!);
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: () => api.runs.create(projectId!, "manual"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-400">{(error as Error)?.message ?? "Project not found"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-white transition-colors">Projects</Link>
        <span>/</span>
        <span className="text-white">{data.name}</span>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{data.name}</h1>
          <a
            href={data.base_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline text-sm mt-1 inline-block"
          >
            {data.base_url}
          </a>
        </div>
        <button
          disabled={runMutation.isPending}
          onClick={() => runMutation.mutate()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {runMutation.isPending ? "Starting…" : "Run Now"}
        </button>
      </div>

      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-3">Runs</h2>

      {data.runs.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-12 text-center">
          <p className="text-gray-400">No runs yet. Click Run Now to start crawling.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Triggered</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Pages</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Findings</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.runs.map((run) => (
                <tr key={run.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/runs/${run.id}`}>
                      <RunStatusBadge status={run.status} />
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm capitalize">{run.triggered_by}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{run.pages_crawled}</td>
                  <td className="px-4 py-3 text-sm">
                    {run.findings_count > 0 ? (
                      <span className="text-yellow-400 font-medium">{run.findings_count}</span>
                    ) : (
                      <span className="text-gray-500">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {new Date(run.started_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
