import { NextResponse } from "next/server";

export async function GET() {
  const authUrl = process.env.AUTH_API_URL;
  if (!authUrl) return NextResponse.json([]);

  try {
    const res = await fetch(`${authUrl}/admin/users`, {
      headers: { "x-api-key": process.env.INTERNAL_API_KEY ?? "" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([]);
  }
}
