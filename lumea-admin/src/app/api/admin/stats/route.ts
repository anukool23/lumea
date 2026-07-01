import { NextResponse } from "next/server";

export async function GET() {
  // Fetch from relevant services — stub returns zeroes until connected
  try {
    const [postsRes, usersRes] = await Promise.allSettled([
      fetch(`${process.env.POST_API_URL}/admin/stats`, {
        headers: { "x-api-key": process.env.INTERNAL_API_KEY ?? "" },
        signal: AbortSignal.timeout(3000),
      }),
      fetch(`${process.env.AUTH_API_URL}/admin/stats`, {
        headers: { "x-api-key": process.env.INTERNAL_API_KEY ?? "" },
        signal: AbortSignal.timeout(3000),
      }),
    ]);

    const posts = postsRes.status === "fulfilled" && postsRes.value.ok
      ? await postsRes.value.json()
      : {};
    const users = usersRes.status === "fulfilled" && usersRes.value.ok
      ? await usersRes.value.json()
      : {};

    return NextResponse.json([
      { label: "Total posts",  value: String(posts.total  ?? "—") },
      { label: "Active users", value: String(users.active ?? "—") },
      { label: "Emails sent",  value: String(posts.emails ?? "—") },
      { label: "AI requests",  value: String(posts.ai     ?? "—") },
    ]);
  } catch {
    return NextResponse.json([
      { label: "Total posts",  value: "—" },
      { label: "Active users", value: "—" },
      { label: "Emails sent",  value: "—" },
      { label: "AI requests",  value: "—" },
    ]);
  }
}
