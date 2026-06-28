/**
 * BFF Proxy — /api/proxy/[service]/[...path]
 *
 * All browser traffic goes through here. The actual backend URLs and the
 * X-API-Key are stored in server-side env vars (no NEXT_PUBLIC_ prefix), so
 * they are never visible in the browser network tab.
 *
 * Service map:
 *   auth-svc          → AUTH_API_URL          (lumea-auth)
 *   post-svc          → POST_API_URL           (lumea-post)
 *   content-svc       → CONTENT_API_URL        (lumea-content)
 *   interaction-svc   → INTERACTION_API_URL    (lumea-interaction)
 *   analytics-svc     → ANALYTICS_API_URL      (lumea-analytics)
 *   notifications-svc → NOTIFICATIONS_API_URL  (lumea-notifications)
 *   ai-svc            → AI_API_URL             (lumea-ai)
 *   media-svc         → MEDIA_API_URL          (lumea-media)
 */

import { NextRequest, NextResponse } from "next/server";

const SERVICE_MAP: Record<string, string | undefined> = {
  "auth-svc":          process.env.AUTH_API_URL,
  "post-svc":          process.env.POST_API_URL,
  "content-svc":       process.env.CONTENT_API_URL,
  "interaction-svc":   process.env.INTERACTION_API_URL,
  "analytics-svc":     process.env.ANALYTICS_API_URL,
  "notifications-svc": process.env.NOTIFICATIONS_API_URL,
  "ai-svc":            process.env.AI_API_URL,
  "media-svc":         process.env.MEDIA_API_URL,
};

async function handler(
  req: NextRequest,
  context: { params: Promise<{ service: string; path: string[] }> }
) {
  const { service, path } = await context.params;
  const baseUrl = SERVICE_MAP[service];

  if (!baseUrl) {
    return NextResponse.json({ error: `Unknown service: ${service}` }, { status: 404 });
  }

  // Build target URL: baseUrl/api/<rest-of-path>?<original-query>
  const restPath = path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${baseUrl}/api/${restPath}${search}`;

  // Build forwarded headers — inject X-API-Key from server env
  const forwardHeaders = new Headers();
  forwardHeaders.set("Content-Type", req.headers.get("Content-Type") ?? "application/json");
  forwardHeaders.set("X-API-Key", process.env.API_KEY ?? "");

  // Pass through the user's JWT if present
  const authorization = req.headers.get("Authorization");
  if (authorization) forwardHeaders.set("Authorization", authorization);

  // Pass through internal token for service-to-service calls initiated by FE (rare)
  const internalToken = req.headers.get("X-Internal-Token");
  if (internalToken) forwardHeaders.set("X-Internal-Token", internalToken);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });
  } catch (err) {
    console.error(`[BFF] Proxy error → ${targetUrl}:`, err);
    return NextResponse.json({ error: "Upstream service unavailable" }, { status: 502 });
  }

  const responseBody = await response.text();
  const contentType = response.headers.get("Content-Type") ?? "application/json";

  return new NextResponse(responseBody, {
    status: response.status,
    headers: { "Content-Type": contentType },
  });
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
export const OPTIONS = handler;
