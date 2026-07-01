import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const commsUrl = process.env.COMMS_API_URL;
  if (!commsUrl) {
    console.error("COMMS_API_URL not set");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Forward to lumea-comms newsletter subscription endpoint
  const upstream = await fetch(`${commsUrl}/newsletter/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.INTERNAL_API_KEY ?? "",
    },
    body: JSON.stringify({ email }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("lumea-comms subscribe error:", detail);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
