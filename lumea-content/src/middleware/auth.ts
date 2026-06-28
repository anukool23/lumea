import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { JWTPayload } from "../types/env.d";

declare module "hono" {
  interface ContextVariableMap {
    user?: JWTPayload;
  }
}

/**
 * requireAuth — hard gate, 401 if no valid token
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const user = await extractUser(c.req.header("Authorization"), process.env.JWT_SECRET!);
  if (!user) throw new HTTPException(401, { message: "Authorization required" });
  c.set("user", user);
  await next();
});

/**
 * optionalAuth — soft gate, populates c.var.user if token valid, no error if missing
 */
export const optionalAuth = createMiddleware(async (c, next) => {
  const user = await extractUser(c.req.header("Authorization"), process.env.JWT_SECRET!);
  if (user) c.set("user", user);
  await next();
});

async function extractUser(
  header: string | undefined,
  secret: string
): Promise<JWTPayload | null> {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sigB64),
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64))
    ) as JWTPayload;

    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
