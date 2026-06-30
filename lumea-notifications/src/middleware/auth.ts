import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { AppEnv, JWTPayload } from "../types/env.d";

function base64UrlDecode(str: string): Uint8Array {
  const pad = str + "=".repeat((4 - (str.length % 4)) % 4);
  const b = atob(pad.replace(/-/g, "+").replace(/_/g, "/"));
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}

async function verifyToken(token: string): Promise<JWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const [h, p, s] = parts;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.JWT_SECRET!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify(
    "HMAC", key,
    base64UrlDecode(s),
    new TextEncoder().encode(`${h}.${p}`)
  );
  if (!ok) throw new Error("Invalid signature");

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(p))) as JWTPayload;
  if (payload.exp < Date.now() / 1000) throw new Error("Token expired");
  return payload;
}

export async function getAuthUser(c: Context<AppEnv>): Promise<JWTPayload> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }
  try {
    return await verifyToken(header.slice(7));
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
}
