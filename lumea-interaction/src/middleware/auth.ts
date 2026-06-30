import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import type { JWTPayload } from "../types/env.d";
import { getRedis, RedisKeys } from "../lib/redis";

/**
 * Throws HTTPException(401) if token is missing, invalid, or blacklisted.
 * Use inside openapi() handlers directly.
 */
export async function getAuthUser(c: Context): Promise<JWTPayload> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Authorization header required" });
  }

  const token = header.slice(7);
  let payload: JWTPayload;
  try {
    payload = await verifyJWT(token, process.env.JWT_SECRET!);
  } catch {
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }

  const redis = getRedis();
  const blacklisted = await redis.exists(RedisKeys.jwtBlacklist(payload.jti));
  if (blacklisted) {
    throw new HTTPException(401, { message: "Token has been revoked" });
  }

  return payload;
}

/**
 * Returns null instead of throwing — for routes where auth is optional.
 */
export async function tryGetAuthUser(c: Context): Promise<JWTPayload | null> {
  try {
    return await getAuthUser(c);
  } catch {
    return null;
  }
}

// ── Internal JWT verification ─────────────────────────────────────────────────

async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, signatureB64] = parts;
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const valid = await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    base64urlDecode(signatureB64),
    encoder.encode(`${headerB64}.${payloadB64}`)
  );
  if (!valid) throw new Error("Invalid signature");

  const payload = JSON.parse(
    new TextDecoder().decode(base64urlDecode(payloadB64))
  ) as JWTPayload;

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
