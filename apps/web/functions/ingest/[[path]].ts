// Cloudflare Pages Function: reverse proxy /ingest/* to PostHog (US) so ad blockers
// don't drop dashboard analytics. Static assets come from the assets host.
const INGEST_HOST = "us.i.posthog.com";
const ASSETS_HOST = "us-assets.i.posthog.com";

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  const url = new URL(request.url);
  const rest = url.pathname.replace(/^\/ingest/, "") || "/";
  const host = rest.startsWith("/static/") ? ASSETS_HOST : INGEST_HOST;
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.set("host", host);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return fetch(`https://${host}${rest}${url.search}`, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
  });
};
