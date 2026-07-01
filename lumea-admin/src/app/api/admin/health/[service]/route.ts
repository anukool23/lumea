import { NextRequest, NextResponse } from "next/server";

const SERVICE_URLS: Record<string, string | undefined> = {
  post:          process.env.POST_API_URL,
  auth:          process.env.AUTH_API_URL,
  comms:         process.env.COMMS_API_URL,
  analytics:     process.env.ANALYTICS_API_URL,
  notifications: process.env.NOTIFICATIONS_API_URL,
  interaction:   process.env.INTERACTION_API_URL,
  ai:            process.env.AI_API_URL,
};

type Params = { service: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { service } = await params;
  const base = SERVICE_URLS[service];

  if (!base) {
    return NextResponse.json({ error: "Unknown service" }, { status: 404 });
  }

  try {
    const upstream = await fetch(`${base}/health`, {
      headers: { "x-api-key": process.env.INTERNAL_API_KEY ?? "" },
      signal: AbortSignal.timeout(4000),
    });
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "Unreachable" }, { status: 502 });
  }
}
