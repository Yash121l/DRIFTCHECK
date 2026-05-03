import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../hooks/useProject";
import { api } from "../lib/api";

function timeAgo(ts: number): string {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export default function Projects() {
  const { data: projects, isLoading, error } = useProjects();
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: (id: string) => api.runs.create(id, "manual"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  if (isLoading) return <div className="spinner-screen"><div className="spinner" /></div>;
  if (error) return <div className="spinner-screen" style={{ color: "var(--red)", fontSize: 13 }}>{(error as Error).message}</div>;

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-sub">
            {projects?.length ?? 0} site{(projects?.length ?? 0) !== 1 ? "s" : ""} monitored
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
          </svg>
          New Project
        </button>
      </div>

      {projects?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
              <circle cx="9" cy="9" r="7" /><circle cx="9" cy="9" r="2" />
              <line x1="9" y1="1" x2="9" y2="4" /><line x1="9" y1="14" x2="9" y2="17" />
              <line x1="1" y1="9" x2="4" y2="9" /><line x1="14" y1="9" x2="17" y2="9" />
            </svg>
          </div>
          <p className="empty-state-title">No projects yet</p>
          <p className="empty-state-sub">Add a site to start monitoring for visual drift</p>
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowModal(true)}>
            Create first project
          </button>
        </div>
      ) : (
        <table className="dc-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>URL</th>
              <th>Last Run</th>
              <th>Max Pages</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects?.map(p => (
              <tr key={p.id}>
                <td>
                  <Link to={`/projects/${p.id}`} className="link-accent" style={{ fontSize: 13, fontWeight: 700 }}>
                    {p.name}
                  </Link>
                  <p className="truncate-id" style={{ marginTop: 2 }}>{p.id.slice(0, 8)}…</p>
                </td>
                <td>
                  <a href={p.base_url} target="_blank" rel="noopener noreferrer" className="link-dim"
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                    {p.base_url.replace(/^https?:\/\//, "")}
                  </a>
                </td>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                  {p.last_run_at ? timeAgo(p.last_run_at) : <span style={{ color: "var(--text-3)" }}>Never</span>}
                </td>
                <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{p.max_pages}</td>
                <td style={{ textAlign: "right" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={runMutation.isPending}
                    onClick={() => runMutation.mutate(p.id)}
                  >
                    {runMutation.isPending ? "…" : "Run Now"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function NewProjectModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", baseUrl: "", alertEmail: "", cronSchedule: "", maxPages: "50" });
  const [err, setErr] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.projects.create({
      name: form.name,
      baseUrl: form.baseUrl,
      alertEmail: form.alertEmail || undefined,
      cronSchedule: form.cronSchedule || undefined,
      maxPages: Math.min(100, Math.max(1, Number(form.maxPages) || 50)),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); onClose(); },
    onError: (e) => setErr(e instanceof Error ? e.message : "Failed"),
  });

  function set(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <p className="modal-title">New Project</p>

        {err && <div className="error-banner">{err}</div>}

        <div className="field">
          <label className="field-label">Name *</label>
          <input className="field-input" placeholder="My Website" value={form.name} onChange={set("name")} />
        </div>
        <div className="field">
          <label className="field-label">Base URL * (HTTPS)</label>
          <input className="field-input" placeholder="https://example.com" value={form.baseUrl} onChange={set("baseUrl")} />
        </div>
        <div className="field">
          <label className="field-label">Alert Email</label>
          <input className="field-input" placeholder="alerts@example.com" value={form.alertEmail} onChange={set("alertEmail")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label className="field-label">Cron Schedule</label>
            <input className="field-input" placeholder="0 9 * * 1-5" value={form.cronSchedule} onChange={set("cronSchedule")} />
          </div>
          <div className="field">
            <label className="field-label">Max Pages (1–100)</label>
            <input className="field-input" type="number" min="1" max="100" value={form.maxPages} onChange={set("maxPages")} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={mutation.isPending || !form.name || !form.baseUrl}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Creating…" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}
