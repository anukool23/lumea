import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { JWTPayload, HonoVariables } from "../types/env.d";
import { getRedis, RedisKeys } from "../lib/redis";

/**
 * Verifies the JWT using the Web Crypto API (HS256).
 * Reads JWT_SECRET from process.env — no Auth Service round-trip.
 * Checks Upstash Redis blacklist for logged-out tokens.
 */
export const requireAuth = createMiddleware<{ Variables: HonoVariables }>(
  async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new HTTPException(401, { message: "Authorization header required" });
    }

    const token = header.slice(7);
    const secret = process.env.JWT_SECRET!;

    let payload: JWTPayload;
    try {
      payload = await verifyJWT(token, secret);
    } catch {
      throw new HTTPException(401, { message: "Invalid or expired token" });
    }

    const redis = getRedis();
    const blacklisted = await redis.exists(RedisKeys.jwtBlacklist(payload.jti));
    if (blacklisted) {
      throw new HTTPException(401, { message: "Token has been revoked" });
    }

    c.set("user", payload);
    await next();
  }
);

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

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
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
