import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  // Simple hardcoded admin check — replace with your auth service call
  const adminEmail    = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("ADMIN_EMAIL / ADMIN_PASSWORD not configured");
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }

  if (email !== adminEmail || password !== adminPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Simple signed token — swap for JWT if needed
  const token = Buffer.from(`${email}:${Date.now()}`).toString("base64");

  return NextResponse.json({
    token,
    user: { id: "admin", email, name: "Admin" },
  });
}
