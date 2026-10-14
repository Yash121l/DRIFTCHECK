import { afterEach, describe, expect, it, vi } from "vitest";
import { capture, sendEvent } from "../analytics";

afterEach(() => vi.unstubAllGlobals());

describe("analytics", () => {
  it("does nothing without POSTHOG_KEY", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await sendEvent({}, "run_completed", { pages_crawled: 3 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts an anonymous event tagged with the app and never throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const waits: Promise<unknown>[] = [];
    capture({ POSTHOG_KEY: "phc_test" }, { waitUntil: (p) => waits.push(p) }, "cron_tick", { runs_started: 2 });
    await expect(Promise.all(waits)).resolves.toBeDefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://us.i.posthog.com/i/v0/e/");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ event: "cron_tick", distinct_id: "driftcheck-worker", properties: { app: "driftcheck", $process_person_profile: false, runs_started: 2 } });
  });
});
