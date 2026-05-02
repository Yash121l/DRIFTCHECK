import { describe, expect, it, vi } from "vitest";
import { app } from "../index";
import type { Env } from "../types";

// Minimal env mock — only what the validation layer touches before hitting D1
function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          first: vi.fn().mockResolvedValue(null),
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      }),
    },
    AI: { run: vi.fn() },
    SCREENSHOTS: { put: vi.fn(), get: vi.fn(), head: vi.fn(), createSignedUrl: vi.fn() },
    SCREENSHOT_VECTORS: { query: vi.fn(), upsert: vi.fn() },
    CRAWL_WORKFLOW: { create: vi.fn().mockResolvedValue({ id: "wf-123" }) },
    EMAIL: { send: vi.fn() },
    API_KEYS: { get: vi.fn().mockResolvedValue(null) },
    BROWSER: {} as Fetcher,
    BASE_URL: "https://test.example.com",
    ...overrides,
  } as unknown as Env;
}

describe("POST /api/projects — schema validation", () => {
  it("rejects empty body with 400", async () => {
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("rejects http:// baseUrl (must be HTTPS)", async () => {
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test", baseUrl: "http://example.com" }),
    }, makeEnv());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: unknown };
    expect(JSON.stringify(body.error)).toContain("HTTPS");
  });

  it("rejects maxPages > 100", async () => {
    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test", baseUrl: "https://example.com", maxPages: 999 }),
    }, makeEnv());
    expect(res.status).toBe(400);
  });

  it("accepts valid payload and creates project", async () => {
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({}),
            first: vi.fn().mockResolvedValue({
              id: "aaaaaaaa-0000-4000-8000-000000000001",
              name: "My Site",
              base_url: "https://example.com",
              alert_email: null,
              cron_schedule: null,
              max_pages: 50,
              viewport_width: 1440,
              viewport_height: 900,
              created_at: Date.now(),
              last_run_at: null,
            }),
          }),
        }),
      } as unknown as D1Database,
    });

    const res = await app.request("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "My Site", baseUrl: "https://example.com" }),
    }, env);
    expect(res.status).toBe(201);
    const body = await res.json() as { name: string };
    expect(body.name).toBe("My Site");
  });
});

describe("GET /api/projects/:id — UUID guard", () => {
  it("rejects non-UUID with 400", async () => {
    const res = await app.request("/api/projects/not-a-uuid", {}, makeEnv());
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid project id/i);
  });

  it("returns 404 for valid UUID that does not exist", async () => {
    const res = await app.request(
      "/api/projects/aaaaaaaa-0000-4000-8000-000000000001",
      {},
      makeEnv()
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/runs/:runId — UUID guard", () => {
  it("rejects non-UUID with 400", async () => {
    const res = await app.request("/api/runs/bad-id", {}, makeEnv());
    expect(res.status).toBe(400);
  });
});

describe("POST /api/findings/:id/review — auth", () => {
  const validFindingId = "dddddddd-0000-4000-8000-000000000001";

  it("returns 401 when Authorization header is missing", async () => {
    const res = await app.request(
      `/api/findings/${validFindingId}/review`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"action":"approved"}' },
      makeEnv()
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 when token does not match stored key", async () => {
    const env = makeEnv({
      API_KEYS: { get: vi.fn().mockResolvedValue("correct-token") } as unknown as KVNamespace,
    });
    const res = await app.request(
      `/api/findings/${validFindingId}/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer wrong-token" },
        body: '{"action":"approved"}',
      },
      env
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid UUID finding ID", async () => {
    const env = makeEnv({
      API_KEYS: { get: vi.fn().mockResolvedValue("my-key") } as unknown as KVNamespace,
    });
    const res = await app.request(
      `/api/findings/not-a-uuid/review`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer my-key" },
        body: '{"action":"approved"}',
      },
      env
    );
    expect(res.status).toBe(400);
  });
});
