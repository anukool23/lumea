import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, message, callDate } = body;

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const commsUrl = process.env.COMMS_API_URL;
  if (!commsUrl) {
    console.error("COMMS_API_URL not set");
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const text = callDate
    ? `${message}\n\n---\nScheduled call: ${new Date(callDate).toLocaleString()}`
    : message;

  const upstream = await fetch(`${commsUrl}/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.INTERNAL_API_KEY ?? "",
    },
    body: JSON.stringify({
      to: process.env.CONTACT_RECIPIENT_EMAIL ?? "hello@lumea.ink",
      subject: `Contact from ${name}`,
      body: text,
      reply_to: email,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    console.error("lumea-comms error:", detail);
    return NextResponse.json({ error: "Failed to send" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
