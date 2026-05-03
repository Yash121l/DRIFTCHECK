import { useRef, useState } from "react";
import { api } from "../lib/api";

interface Props {
  currentKey: string;
  baselineKey: string | null;
  diffScore: number;
}

function ImgPane({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100%", gap: 8, background: "var(--sf-2)",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 15l5-5 4 4 3-3 6 6" />
          <circle cx="8.5" cy="8.5" r="1.5" />
        </svg>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text-3)" }}>
          {src ? "Unavailable" : "No baseline"}
        </p>
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
  const dragging = useRef(false);

  const currentUrl = api.findings.screenshotUrl(currentKey);
  const baselineUrl = baselineKey ? api.findings.screenshotUrl(baselineKey) : null;

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(5, Math.min(95, pct)));
  }

  const pct = (diffScore * 100).toFixed(1);
  const scoreColor = diffScore > 0.3 ? "var(--red)" : diffScore > 0.15 ? "var(--accent)" : "var(--yellow)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-2)" }}>
          <span style={{ color: scoreColor, fontWeight: 600 }}>{pct}%</span> different
          <span style={{ color: "var(--text-3)", marginLeft: 8 }}>({diffScore.toFixed(4)})</span>
        </p>
        <div style={{ display: "flex", gap: 4 }}>
          {(["split", "overlay"] as const).map(m => (
            <button
              key={m}
              className={`btn btn-sm ${mode === m ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setMode(m)}
              style={{ textTransform: "capitalize" as const }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Viewer */}
      {mode === "split" ? (
        <div
          ref={containerRef}
          style={{
            position: "relative", height: 320, overflow: "hidden",
            borderRadius: 6, border: "1px solid var(--border)",
            cursor: "col-resize", userSelect: "none",
            background: "var(--sf-2)",
          }}
          onMouseMove={onMouseMove}
          onMouseDown={() => { dragging.current = true; }}
          onMouseUp={() => { dragging.current = false; }}
          onMouseLeave={() => { dragging.current = false; }}
        >
          {/* Baseline */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", width: `${sliderPos}%` }}>
            <ImgPane src={baselineUrl} label="Baseline" />
            <span style={{
              position: "absolute", top: 8, left: 8, zIndex: 2,
              fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase" as const,
              background: "rgba(0,0,0,0.7)", color: "var(--text-2)", padding: "2px 6px", borderRadius: 3,
            }}>Baseline</span>
          </div>

          {/* Current */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", left: `${sliderPos}%` }}>
            <img
              src={currentUrl}
              alt="Current"
              style={{ position: "absolute", top: 0, height: "100%", width: "auto", maxWidth: "none", left: `-${sliderPos}%` }}
              onError={() => {}}
            />
            <span style={{
              position: "absolute", top: 8, right: 8, zIndex: 2,
              fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 600,
              letterSpacing: "0.08em", textTransform: "uppercase" as const,
              background: "rgba(0,0,0,0.7)", color: "var(--accent)", padding: "2px 6px", borderRadius: 3,
            }}>Current</span>
          </div>

          {/* Divider */}
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: `${sliderPos}%`,
            width: 1, background: "var(--accent)", zIndex: 10,
            transform: "translateX(-0.5px)",
          }}>
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 22, height: 22, borderRadius: "50%",
              background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
              color: "#000", fontSize: 10, fontWeight: 700, flexShrink: 0,
              boxShadow: "0 0 0 3px rgba(249,115,22,0.25)",
            }}>⇔</div>
          </div>
        </div>
      ) : (
        <div style={{
          position: "relative", height: 320, overflow: "hidden",
          borderRadius: 6, border: "1px solid var(--border)", background: "#fff",
        }}>
          {baselineUrl && (
            <img src={baselineUrl} alt="Baseline"
              style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "contain" }} />
          )}
          <img src={currentUrl} alt="Overlay"
            style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "contain", mixBlendMode: "difference" }} />
          <span style={{
            position: "absolute", top: 8, left: 8,
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
            background: "rgba(0,0,0,0.7)", color: "var(--text-2)", padding: "2px 6px", borderRadius: 3,
          }}>white = changed</span>
        </div>
      )}
    </div>
  );
}
