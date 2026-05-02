import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../hooks/useProject";
import { api } from "../lib/api";

export default function Projects() {
  const { data: projects, isLoading, error } = useProjects();
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: (projectId: string) => api.runs.create(projectId, "manual"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  if (isLoading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={(error as Error).message} />;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">DriftCheck</h1>
          <p className="text-gray-400 text-sm mt-0.5">Visual & accessibility regression monitoring</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Project
        </button>
      </div>

      {projects?.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-900 p-12 text-center">
          <p className="text-gray-400">No projects yet. Create one to start monitoring.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-800/60">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Project</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">URL</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Last Run</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {projects?.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/projects/${p.id}`} className="text-blue-400 hover:underline font-medium">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm truncate max-w-xs">
                    <a href={p.base_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                      {p.base_url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">
                    {p.last_run_at ? new Date(p.last_run_at).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={runMutation.isPending}
                      onClick={() => runMutation.mutate(p.id)}
                      className="text-xs px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-50"
                    >
                      Run Now
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    baseUrl: "",
    alertEmail: "",
    cronSchedule: "",
    maxPages: "50",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.projects.create({
        name: form.name,
        baseUrl: form.baseUrl,
        alertEmail: form.alertEmail || undefined,
        cronSchedule: form.cronSchedule || undefined,
        maxPages: Math.min(100, Math.max(1, Number(form.maxPages) || 50)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create project"),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">New Project</h2>

        <Field label="Name *">
          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Website" />
        </Field>
        <Field label="Base URL * (HTTPS)">
          <input className={inputClass} value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://example.com" />
        </Field>
        <Field label="Alert Email">
          <input className={inputClass} value={form.alertEmail} onChange={(e) => setForm({ ...form, alertEmail: e.target.value })} placeholder="alerts@example.com" />
        </Field>
        <Field label="Cron Schedule">
          <input className={inputClass} value={form.cronSchedule} onChange={(e) => setForm({ ...form, cronSchedule: e.target.value })} placeholder="0 9 * * 1-5" />
        </Field>
        <Field label="Max Pages (1–100)">
          <input type="number" className={inputClass} value={form.maxPages} onChange={(e) => setForm({ ...form, maxPages: e.target.value })} min="1" max="100" />
        </Field>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button
            disabled={mutation.isPending || !form.name || !form.baseUrl}
            onClick={() => mutation.mutate()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-red-400">{message}</p>
    </div>
  );
}
