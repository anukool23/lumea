import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

const EXEMPT = new Set(["/health", "/docs", "/openapi.json"]);

/**
 * Validates the X-Internal-Token header against INTERNAL_SERVICE_TOKEN env var.
 * /health, /docs, and /openapi.json are always exempt.
 */
export function requireInternalToken() {
  return createMiddleware(async (c, next) => {
    if (EXEMPT.has(c.req.path)) {
      return next();
    }

    const token = c.req.header("X-Internal-Token");
    const expected = process.env.INTERNAL_SERVICE_TOKEN;

    if (!expected) {
      // Misconfigured — fail closed
      throw new HTTPException(503, { message: "Service misconfigured: INTERNAL_SERVICE_TOKEN not set" });
    }

    if (!token || token !== expected) {
      throw new HTTPException(403, { message: "Invalid or missing internal token" });
    }

    return next();
  });
}
