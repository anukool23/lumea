import { type NextRequest, NextResponse } from "next/server";

const SERVICE_MAP: Record<string, string | undefined> = {
  auth:          process.env.AUTH_API_URL,
  posts:         process.env.POST_API_URL,
  content:       process.env.CONTENT_API_URL,
  interactions:  process.env.INTERACTION_API_URL,
  analytics:     process.env.ANALYTICS_API_URL,
  notifications: process.env.NOTIFICATIONS_API_URL,
  ai:            process.env.AI_API_URL,
  media:         process.env.MEDIA_API_URL,
};

type Params = { service: string; path: string[] };

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<Params> }
): Promise<NextResponse> {
  const { service, path } = await params;
  const base = SERVICE_MAP[service];

  if (!base) {
    return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  }

  const upstream = `${base}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.set("x-api-key", process.env.API_KEY ?? "");
  headers.delete("host");

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : req.body;

  try {
    const res = await fetch(upstream, {
      method:  req.method,
      headers,
      body,
      // @ts-expect-error — Next.js 15 Node.js fetch supports duplex
      duplex: "half",
    });

    const resHeaders = new Headers(res.headers);
    resHeaders.delete("content-encoding"); // let Next.js handle compression

    return new NextResponse(res.body, {
      status:  res.status,
      headers: resHeaders,
    });
  } catch (err) {
    console.error(`[proxy] ${service} → ${upstream}`, err);
    return NextResponse.json({ error: "Upstream error" }, { status: 502 });
  }
}

export const GET    = proxy;
export const POST   = proxy;
export const PUT    = proxy;
export const PATCH  = proxy;
export const DELETE = proxy;
