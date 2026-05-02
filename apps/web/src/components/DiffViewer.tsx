import { useRef, useState } from "react";
import { api } from "../lib/api";

interface Props {
  currentKey: string;
  baselineKey: string | null;
  diffScore: number;
}

function ScreenshotPane({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-gray-800 gap-2">
        <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-500 text-xs">{src ? "Screenshot unavailable" : "No baseline yet"}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      className="absolute top-0 left-0 h-full w-auto max-w-none"
      onError={() => setFailed(true)}
    />
  );
}

export default function DiffViewer({ currentKey, baselineKey, diffScore }: Props) {
  const [sliderPos, setSliderPos] = useState(50);
  const [mode, setMode] = useState<"split" | "overlay">("split");
  const containerRef = useRef<HTMLDivElement>(null);

  const currentUrl = api.findings.screenshotUrl(currentKey);
  const baselineUrl = baselineKey ? api.findings.screenshotUrl(baselineKey) : null;

  function handleMouseMove(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(5, Math.min(95, pct)));
  }

  const pctDiff = (diffScore * 100).toFixed(1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          <span className={`font-semibold ${diffScore > 0.3 ? "text-red-400" : diffScore > 0.15 ? "text-orange-400" : "text-yellow-400"}`}>
            {pctDiff}% different
          </span>{" "}
          from baseline (cosine distance: {diffScore.toFixed(4)})
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("split")}
            className={`px-3 py-1 text-xs rounded ${mode === "split" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"}`}
          >
            Split
          </button>
          <button
            onClick={() => setMode("overlay")}
            className={`px-3 py-1 text-xs rounded ${mode === "overlay" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"}`}
          >
            Overlay
          </button>
        </div>
      </div>

      {mode === "split" ? (
        <div
          ref={containerRef}
          className="relative h-96 overflow-hidden rounded-lg border border-gray-700 cursor-col-resize select-none"
          onMouseMove={handleMouseMove}
        >
          {/* Baseline (left) */}
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
            <ScreenshotPane src={baselineUrl} label="Baseline" />
            <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-gray-300 z-10">Baseline</div>
          </div>

          {/* Current (right) */}
          <div className="absolute inset-0 overflow-hidden" style={{ left: `${sliderPos}%` }}>
            <ScreenshotPane src={currentUrl} label="Current" />
            <div className="absolute top-2 right-2 rounded bg-black/60 px-2 py-0.5 text-xs text-gray-300 z-10">Current</div>
          </div>

          {/* Slider divider */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 cursor-col-resize z-20"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-white rounded-full w-6 h-6 flex items-center justify-center text-gray-800 text-xs font-bold shadow">
              ⇔
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-96 rounded-lg border border-gray-700 overflow-hidden bg-gray-900">
          <ScreenshotPane src={baselineUrl} label="Baseline" />
          {currentUrl && (
            <img
              src={currentUrl}
              alt="Current (overlay)"
              className="absolute inset-0 h-full w-full object-contain"
              style={{ mixBlendMode: "difference" }}
            />
          )}
          <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-gray-300 z-10">
            Pixel diff (white = changed)
          </div>
        </div>
      )}
    </div>
  );
}
