import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

/**
 * Validates the X-API-Key header against API_KEYS env var (hyphen-separated).
 * /health, /docs, and /openapi.json are always exempted.
 * If API_KEYS is empty (local dev), the check is skipped entirely.
 */
export function requireAPIKey() {
  const raw = process.env.API_KEYS ?? "";
  const validKeys = new Set(raw.split("-").filter(Boolean));

  return createMiddleware(async (c, next) => {
    const path = c.req.path;
    if (path === "/health" || path === "/docs" || path === "/openapi.json") {
      return next();
    }

    if (validKeys.size === 0) return next();

    const key = c.req.header("X-API-Key") ?? "";
    if (!validKeys.has(key)) {
      throw new HTTPException(401, { message: "Invalid or missing API key" });
    }

    return next();
  });
}
