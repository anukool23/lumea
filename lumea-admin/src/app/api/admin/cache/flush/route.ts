import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { pattern } = await req.json();

  const redisUrl   = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 503 });
  }

  try {
    // SCAN + DEL matching keys
    const scanRes = await fetch(`${redisUrl}/scan/0/match/${encodeURIComponent(pattern)}/count/100`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    const scanData = await scanRes.json();
    const keys: string[] = scanData.result?.[1] ?? [];

    if (keys.length > 0) {
      await fetch(`${redisUrl}/del/${keys.map(encodeURIComponent).join("/")}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${redisToken}` },
      });
    }

    return NextResponse.json({ ok: true, flushed: keys.length });
  } catch (err) {
    console.error("Cache flush error:", err);
    return NextResponse.json({ error: "Failed to flush" }, { status: 500 });
  }
}
