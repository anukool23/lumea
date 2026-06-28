/**
 * BFF Proxy — /api/proxy/[service]/[...path]
 *
 * All browser traffic from the writer dashboard goes through here.
 * Backend URLs and X-API-Key stay server-side — invisible to browser devtools.
 *
 * Service map:
 *   auth-svc          → AUTH_API_URL
 *   post-svc          → POST_API_URL
 *   content-svc       → CONTENT_API_URL
 *   analytics-svc     → ANALYTICS_API_URL
 *   ai-svc            → AI_API_URL
 *   media-svc         → MEDIA_API_URL
 *   notifications-svc → NOTIFICATIONS_API_URL
 */

import { NextRequest, NextResponse } from "next/server";

const SERVICE_MAP: Record<string, string | undefined> = {
  "auth-svc":          process.env.AUTH_API_URL,
  "post-svc":          process.env.POST_API_URL,
  "content-svc":       process.env.CONTENT_API_URL,
  "analytics-svc":     process.env.ANALYTICS_API_URL,
  "ai-svc":            process.env.AI_API_URL,
  "media-svc":         process.env.MEDIA_API_URL,
  "notifications-svc": process.env.NOTIFICATIONS_API_URL,
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

  const restPath = path.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `${baseUrl}/api/${restPath}${search}`;

  const forwardHeaders = new Headers();
  forwardHeaders.set("Content-Type", req.headers.get("Content-Type") ?? "application/json");
  // Dashboard uses API key #2 so traffic can be distinguished from portal in logs
  forwardHeaders.set("X-API-Key", process.env.API_KEY ?? "");

  const authorization = req.headers.get("Authorization");
  if (authorization) forwardHeaders.set("Authorization", authorization);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });
  } catch (err) {
    console.error(`[BFF-dash] Proxy error → ${targetUrl}:`, err);
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
