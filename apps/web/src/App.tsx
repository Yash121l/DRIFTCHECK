import { Route, Routes } from "react-router-dom";
import PageInspector from "./pages/PageInspector";
import ProjectDetail from "./pages/ProjectDetail";
import Projects from "./pages/Projects";
import RunDetail from "./pages/RunDetail";

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetail />} />
        <Route path="/runs/:runId" element={<RunDetail />} />
        <Route path="/runs/:runId/findings/:findingId" element={<PageInspector />} />
      </Routes>
    </div>
  );
}
