// PostHog server-side events. Counts, ids and timings only: no site URLs, page paths or
// finding text. A no-op without POSTHOG_KEY (tests, local dev without vars).
import type { Env } from "./types";

const INGEST = "https://us.i.posthog.com/i/v0/e/";

/** Send one anonymous event. Never throws, gives up after 5s. */
export function sendEvent(env: Pick<Env, "POSTHOG_KEY">, event: string, properties: Record<string, unknown> = {}): Promise<void> {
  if (!env.POSTHOG_KEY) return Promise.resolve();
  return fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.POSTHOG_KEY,
      event,
      distinct_id: "driftcheck-worker",
      timestamp: new Date().toISOString(),
      properties: { app: "driftcheck", $process_person_profile: false, ...properties },
    }),
    signal: AbortSignal.timeout(5000),
  }).then(
    () => undefined,
    () => undefined,
  );
}

/** Fire-and-forget from a request or cron handler. */
export function capture(env: Pick<Env, "POSTHOG_KEY">, ctx: { waitUntil(p: Promise<unknown>): void } | undefined, event: string, properties: Record<string, unknown> = {}) {
  const p = sendEvent(env, event, properties);
  if (ctx) ctx.waitUntil(p);
}
