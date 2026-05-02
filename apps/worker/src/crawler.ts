import puppeteer from "@cloudflare/puppeteer";
import type { CrawlConfig, Env, PageCrawlResult, Result } from "./types";

export async function discoverPages(
  baseUrl: string,
  maxPages: number,
  browser: Fetcher
): Promise<string[]> {
  const b = await puppeteer.launch(browser);
  const page = await b.newPage();
  const discovered = new Set<string>([baseUrl]);
  const queue = [baseUrl];

  while (queue.length > 0 && discovered.size < maxPages) {
    const url = queue.shift()!;
    try {
      await page.goto(url, { waitUntil: "networkidle0", timeout: 15000 });
      const links = await page.$$eval("a[href]", (els) =>
        els.flatMap((el) => {
          const href = el.getAttribute("href");
          return href ? [href] : [];
        })
      );
      for (const link of links) {
        if (link.startsWith(baseUrl) && !discovered.has(link) && discovered.size < maxPages) {
          discovered.add(link);
          queue.push(link);
        }
      }
    } catch (err) {
      console.error(`Discovery failed for ${url}:`, err);
    }
  }

  await b.close();
  return Array.from(discovered);
}

export async function crawlPage(
  url: string,
  config: CrawlConfig,
  env: Env
): Promise<Result<PageCrawlResult>> {
  let b: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    b = await puppeteer.launch(env.BROWSER);
    const page = await b.newPage();

    await page.setViewport({ width: config.viewportWidth, height: config.viewportHeight });

    const startTime = Date.now();
    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
    const loadTimeMs = Date.now() - startTime;

    const screenshotBuffer = await page.screenshot({ fullPage: true, type: "png" });
    // screenshotBuffer from @cloudflare/puppeteer is already a Buffer/Uint8Array
    const buf = screenshotBuffer as unknown as Uint8Array;
    const screenshotBase64 = Buffer.from(buf).toString("base64");

    const path = new URL(url).pathname || "/";
    const runDate = new Date().toISOString().split("T")[0];
    const safePath = path.replace(/\//g, "_").replace(/^_/, "") || "root";
    const screenshotKey = `screenshots/${config.projectId}/${runDate}/${config.runId}/${safePath}.png`;

    await env.SCREENSHOTS.put(screenshotKey, buf, {
      httpMetadata: { contentType: "image/png" },
      customMetadata: { url, runId: config.runId, projectId: config.projectId },
    });

    const title = await page.title();
    await b.close();

    return {
      ok: true,
      value: { url, path, screenshotKey, screenshotBase64, loadTimeMs, statusCode: response?.status() ?? 0, title },
    };
  } catch (err) {
    await b?.close();
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`crawlPage failed for ${url}: ${msg}`);
    return { ok: false, error: msg };
  }
}
