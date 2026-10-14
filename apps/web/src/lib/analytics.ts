// Product analytics (PostHog) via the /ingest Pages Function proxy (functions/ingest).
import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
const enabled = !!KEY && (import.meta.env.PROD || import.meta.env.VITE_POSTHOG_DEV === "1") && !LOCAL;

export function initAnalytics() {
  if (!enabled) return;
  posthog.init(KEY!, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    enable_heatmaps: true,
    capture_dead_clicks: true,
    capture_exceptions: true,
    capture_performance: { web_vitals: true },
    session_recording: { maskAllInputs: true },
  });
  posthog.register({ app: "driftcheck" });
}

type Props = Record<string, string | number | boolean | null | undefined>;

export function track(event: string, props: Props = {}) {
  if (enabled) posthog.capture(event, props);
}
