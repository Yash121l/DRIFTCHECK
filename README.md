# DriftCheck

Visual and accessibility regression monitoring on Cloudflare's stack. Crawls any website on a schedule or Git push, diffs screenshots against a baseline using perceptual embeddings, and runs WCAG accessibility audits via Llama-3.2-Vision — with a reviewer dashboard built on Cloudflare Pages.

## Architecture

```
 Git push / Cron / Dashboard
         │
         ▼
 ┌─────────────────┐
 │  Hono Worker    │  (CF Workers, TypeScript strict)
 │  /api/*         │
 └────────┬────────┘
          │  creates
          ▼
 ┌─────────────────────────────┐
 │  CrawlWorkflow              │  (CF Workflows, durable multi-step)
 │                             │
 │  1. discoverPages           │
 │  2. crawlPage ×N (batch=5) ─┼──► Browser Run (Playwright)
 │  3. diffPage    ×N         ─┼──► Workers AI (bge-large embeddings)
 │                             │         │
 │                             │         ▼
 │                             │    Vectorize (cosine distance)
 │  4. auditAccessibility      │──► Workers AI (llama-3.2-11b-vision)
 │  5. persistFindings         │──► D1
 │  6. updateBaselines         │──► Vectorize + R2
 │  7. sendAlertEmail          │──► Email Sending
 │  8. complete run            │──► D1
 └─────────────────────────────┘
          │
          ▼
 ┌─────────────────┐
 │  React Dashboard│  (CF Pages, Vite + Tailwind)
 │                 │
 │  Projects list  │
 │  Run report     │
 │  DiffViewer     │──► R2 signed URLs
 │  LiveView       │──► Browser Run Live View (iframe)
 └─────────────────┘
```

## Quick Start — Deploy to Production

### 1. Prerequisites

```bash
npm install -g wrangler
wrangler login
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create Cloudflare resources

```bash
wrangler d1 create driftcheck-db          # → copy database_id
wrangler r2 bucket create driftcheck-screenshots
wrangler vectorize create driftcheck-perceptual --dimensions=1024 --metric=cosine
wrangler kv namespace create API_KEYS     # → copy id
```

### 4. Update wrangler.toml

In `apps/worker/wrangler.toml`, replace the placeholder IDs:

```toml
[[d1_databases]]
database_id = "PASTE_D1_ID"

[[kv_namespaces]]
id = "PASTE_KV_ID"

[vars]
BASE_URL = "https://driftcheck-worker.<subdomain>.workers.dev"
```

### 5. Apply schema & set API key

```bash
cd apps/worker
npx wrangler d1 execute driftcheck-db --file=src/db/schema.sql --remote
npx wrangler kv key put reviewer "$(openssl rand -hex 32)" --namespace-id=<KV_ID>
```

Save the key — you need it to approve/reject findings in the dashboard.

### 6. Deploy worker

```bash
npx wrangler deploy
```

### 7. Deploy dashboard

```bash
cd ../web
npm run build
npx wrangler pages deploy dist --project-name=driftcheck-web
```

---

## How to Use

### Creating a project

Open the dashboard URL → **+ New Project**

| Field | Description |
|---|---|
| Name | Display name |
| Base URL | HTTPS URL of the site to monitor |
| Alert Email | Receives digest when findings are detected |
| Cron Schedule | e.g. `0 9 * * 1-5` to run weekdays at 09:00 UTC |
| Max Pages | 1–100. Crawler stops after this many pages. |

Or via API:

```bash
curl -X POST https://<worker-url>/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"My Site","baseUrl":"https://example.com","alertEmail":"you@example.com","maxPages":20}'
```

### Triggering a run

Click **Run Now** in the dashboard, or:

```bash
curl -X POST https://<worker-url>/api/projects/<project-id>/runs \
  -H "Content-Type: application/json" \
  -d '{"triggeredBy":"manual"}'
```

A run goes through 8 workflow steps. Expect 2–5 minutes for 20 pages.

### Reading findings

Click a run → two tabs:

**Visual Drift** — pages whose screenshot embedding drifted more than 8% cosine distance from the baseline. Each finding shows:
- Diff score (% and raw distance)
- Severity badge
- Side-by-side DiffViewer with a drag slider (Split mode) or pixel-diff overlay (Overlay mode)
- Live View button — launches an interactive Browser Run session

**Accessibility** — WCAG 2.1 issues found by Llama-3.2-Vision, grouped by criterion.

### Reviewing drift findings

Each visual drift finding has two actions:

- **Approve as Baseline** — accepts the new screenshot as the correct baseline going forward. Updates Vectorize and R2.
- **Reject** — marks the drift as a bug. Baseline is unchanged.

Review requires the API key you set in step 5:

```bash
curl -X POST https://<worker-url>/api/findings/<finding-id>/review \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-api-key>" \
  -d '{"action":"approved"}'
```

---

## How the Perceptual Diff Works

1. Each page screenshot (PNG) is base64-encoded and embedded via `@cf/baai/bge-large-en-v1.5` into a 1024-dimension vector.
2. The current-run vector is compared to the stored baseline vector in Vectorize using **cosine similarity**.
3. `diff_score = 1 − cosine_similarity`. Score of `0` = identical; `2` = maximum difference.
4. Threshold is **0.08** — anything above flags a `visual_drift` finding.

Severity mapping:

| Score | Severity |
|---|---|
| > 0.30 | Critical |
| 0.15 – 0.30 | Major |
| 0.08 – 0.15 | Minor |

> `bge-large` is a text encoder used as a structural proxy. It detects layout and content shifts reliably. Pure CSS color changes (same structure, different colors) may score low — use the accessibility audit for color contrast issues instead.

---

## Connecting GitHub Actions

Run DriftCheck on every deployment:

**Step 1** — Create a webhook secret in D1:

```sql
INSERT INTO webhooks (id, project_id, secret, created_at)
VALUES (lower(hex(randomblob(16))), '<project-uuid>', '<your-secret>', unixepoch() * 1000);
```

**Step 2** — Add to `.github/workflows/deploy.yml`:

```yaml
- name: Trigger DriftCheck
  run: |
    BODY='{}'
    SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac '${{ secrets.DRIFTCHECK_SECRET }}' | cut -d' ' -f2)
    curl -X POST https://<worker-url>/api/webhooks/${{ vars.DRIFTCHECK_PROJECT_ID }} \
      -H "Content-Type: application/json" \
      -H "X-Hub-Signature-256: sha256=$SIG" \
      -d "$BODY"
```

---

## Local Development

```bash
# Terminal 1 — worker (--remote required for Browser Run)
cd apps/worker && npx wrangler dev --remote

# Terminal 2 — dashboard (proxies /api/* to :8787)
cd apps/web && npm run dev
```

Open `http://localhost:5173`.

> Browser Run, Workers AI, and Vectorize require a real Cloudflare account — they don't work with `--local`.

---

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm -w apps/worker run test:watch

# Coverage report
npm run test:coverage
```

Tests cover:
- UUID validation (including injection attempts)
- Path sanitization edge cases
- Drift severity thresholds
- A11y JSON extraction (valid, missing, malformed)
- Cron schedule matching (wildcards, ranges, comma lists)
- API route validation (schema rejection, UUID guards, auth checks)

---

## Analytics

PostHog, US cloud, `app: driftcheck` on every event. The dashboard loads posthog-js through
the `/ingest/*` Pages Function (`apps/web/functions/ingest`) and captures pageviews, web
vitals, replays with masked inputs, and `project_created`, `run_triggered`,
`finding_reviewed` and `live_view_opened`. The worker sends anonymous `run_started`,
`run_completed` and `cron_tick` events with counts and timings only, never site URLs or
finding text. The public project key is `POSTHOG_KEY` in `apps/worker/wrangler.toml` and
`VITE_POSTHOG_KEY` in `apps/web/.env.production`. Remove either to turn that side off.

## Severity Levels

| Level | Visual Drift | Accessibility |
|---|---|---|
| Critical | > 30% drift | WCAG AA failure (contrast < 4.5:1) |
| Major | 15–30% drift | Missing alt text, keyboard trap |
| Minor | 8–15% drift | Heading hierarchy issues |
| Info | Annotation | Best-practice suggestions |
