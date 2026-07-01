import { NextRequest, NextResponse } from "next/server";

type Params = { userId: string; action: "suspend" | "activate" };

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { userId, action } = await params;
  const authUrl = process.env.AUTH_API_URL;
  if (!authUrl) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const upstream = await fetch(`${authUrl}/admin/users/${userId}/${action}`, {
    method: "POST",
    headers: { "x-api-key": process.env.INTERNAL_API_KEY ?? "" },
    signal: AbortSignal.timeout(5000),
  });

  if (!upstream.ok) {
    return NextResponse.json({ error: "Upstream failed" }, { status: upstream.status });
  }
  return NextResponse.json({ ok: true });
}
