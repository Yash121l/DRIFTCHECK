import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

interface Props {
  findingId: string;
  pageUrl: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; liveViewUrl: string; expiresAt: number }
  | { kind: "error"; message: string };

export default function LiveView({ findingId, pageUrl }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [iframeError, setIframeError] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function launch() {
    setState({ kind: "loading" });
    setIframeError(false);
    try {
      const data = await api.findings.liveView(findingId);
      setState({ kind: "ready", liveViewUrl: data.liveViewUrl, expiresAt: Date.now() + 60_000 });
      setSecondsLeft(60);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start live view";
      setState({ kind: "error", message });
    }
  }

  useEffect(() => {
    if (state.kind !== "ready") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      const remaining = Math.round((state.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        setState({ kind: "idle" });
      } else {
        setSecondsLeft(remaining);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state.kind]);

  if (state.kind === "idle") {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-gray-700 bg-gray-900 gap-4">
        <p className="text-gray-400 text-sm text-center px-6">
          Launch an interactive Browser Run session to inspect this page live
        </p>
        <button
          onClick={launch}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
        >
          Open Live View
        </button>
        {pageUrl && (
          <a href={pageUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-blue-400 transition-colors">
            Open original ↗
          </a>
        )}
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg border border-gray-700 bg-gray-900">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Starting Browser Run session…</span>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-red-900/50 bg-gray-900 gap-3 p-6">
        <div className="w-8 h-8 rounded-full bg-red-900/40 flex items-center justify-center">
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-red-400 text-sm text-center">{state.message}</p>
        <div className="flex gap-3">
          <button onClick={launch} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors">
            Retry
          </button>
          {pageUrl && (
            <a href={pageUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded transition-colors">
              Open in new tab
            </a>
          )}
        </div>
      </div>
    );
  }

  // Ready state
  if (iframeError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-yellow-900/50 bg-gray-900 gap-3 p-6">
        <p className="text-yellow-400 text-sm text-center">
          Live View iframe requires production deployment.
        </p>
        <p className="text-gray-500 text-xs text-center">
          Browser Run sessions are only embeddable from Cloudflare Pages, not localhost.
        </p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => setState({ kind: "idle" })} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors">
            Dismiss
          </button>
          <a href={state.liveViewUrl} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded transition-colors">
            Open Live View tab ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Live session expires in{" "}
          <span className={secondsLeft < 15 ? "text-red-400 font-medium" : "text-gray-400"}>
            {secondsLeft}s
          </span>
        </p>
        <a href={state.liveViewUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:underline">Open in tab ↗</a>
      </div>
      <iframe
        src={state.liveViewUrl}
        className="w-full h-[560px] rounded-lg border border-gray-700 bg-gray-900"
        title="Browser Run Live View"
        sandbox="allow-scripts allow-same-origin allow-forms"
        onError={() => setIframeError(true)}
      />
    </div>
  );
}
