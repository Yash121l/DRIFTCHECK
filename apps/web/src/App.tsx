import { NavLink, Route, Routes, useLocation, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PageInspector from "./pages/PageInspector";
import ProjectDetail from "./pages/ProjectDetail";
import Projects from "./pages/Projects";
import RunDetail from "./pages/RunDetail";

export default function App() {
  return (
    <>
      <aside className="sidebar">
        {/* Logo */}
        <NavLink to="/" className="sidebar-logo" end>
          <Reticle />
          <div className="sidebar-logo-wordmark">
            <span className="sidebar-logo-top">DRIFT</span>
            <span className="sidebar-logo-bot">CHECK</span>
          </div>
        </NavLink>

        {/* Nav */}
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
            <IconGrid />
            Projects
          </NavLink>
        </nav>

        {/* Context breadcrumb */}
        <SidebarContext />

        <div className="sidebar-footer">v1.0.0</div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/runs/:runId" element={<RunDetail />} />
          <Route path="/runs/:runId/findings/:findingId" element={<PageInspector />} />
        </Routes>
      </main>
    </>
  );
}

/* ── Sidebar context breadcrumb ─────────────────── */
function SidebarContext() {
  const location = useLocation();
  const qc = useQueryClient();

  const projectMatch = location.pathname.match(/^\/projects\/([^/]+)/);
  const runMatch = location.pathname.match(/^\/runs\/([^/]+)/);
  const findingMatch = location.pathname.match(/^\/runs\/([^/]+)\/findings\/([^/]+)/);

  if (!projectMatch && !runMatch) return null;

  if (projectMatch) {
    const pid = projectMatch[1];
    const proj = qc.getQueryData<{ name: string }>(["project", pid]);
    return (
      <div className="sidebar-context">
        <p className="sidebar-context-label">Project</p>
        <Link to={`/projects/${pid}`} className="sidebar-context-item active">
          <IconChevron />
          {proj?.name ?? pid.slice(0, 8) + "…"}
        </Link>
      </div>
    );
  }

  if (runMatch) {
    const rid = runMatch[1];
    const fid = findingMatch?.[2];
    const run = qc.getQueryData<{ project_id: string }>(["run", rid]);
    const pid = run?.project_id;
    const proj = pid ? qc.getQueryData<{ name: string }>(["project", pid]) : null;

    return (
      <div className="sidebar-context">
        <p className="sidebar-context-label">Context</p>
        {pid && (
          <Link to={`/projects/${pid}`} className="sidebar-context-item">
            <IconChevron />
            {proj?.name ?? pid.slice(0, 8) + "…"}
          </Link>
        )}
        <Link to={`/runs/${rid}`} className={`sidebar-context-item${!fid ? " active" : ""}`} style={{ paddingLeft: 24 }}>
          <span className="sidebar-context-dot" />
          Run {rid.slice(0, 7)}…
        </Link>
        {fid && (
          <span className="sidebar-context-item active" style={{ paddingLeft: 32, cursor: "default" }}>
            <span className="sidebar-context-dot" />
            Finding {fid.slice(0, 7)}…
          </span>
        )}
      </div>
    );
  }

  return null;
}

/* ── Icons ──────────────────────────────────────── */
function Reticle() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <circle cx="15" cy="15" r="9" stroke="#f97316" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="2.5" fill="#f97316" />
      {/* ticks */}
      <line x1="15" y1="3" x2="15" y2="7" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="15" y1="23" x2="15" y2="27" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="3" y1="15" x2="7" y2="15" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="15" x2="27" y2="15" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
      <polyline points="3,2 7,5 3,8" />
    </svg>
  );
}
