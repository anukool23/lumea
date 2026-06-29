import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

/**
 * Validates the X-API-Key header against the list loaded from API_KEYS env var.
 * API_KEYS is a hyphen-separated list of keys, e.g.:
 *   API_KEYS=key1-key2-key3-key4
 *
 * /health, /docs, and /openapi.json are always exempted.
 * If API_KEYS is empty (local dev), the check is skipped entirely.
 */
export function requireAPIKey() {
  const raw = process.env.API_KEYS ?? "";
  const validKeys = new Set(raw.split("-").filter(Boolean));

  return createMiddleware(async (c, next) => {
    // Always allow health checks and Swagger UI
    const path = c.req.path;
    if (path === "/health" || path === "/docs" || path === "/openapi.json") {
      return next();
    }

    // No keys configured → skip (local dev without env)
    if (validKeys.size === 0) return next();

    const key = c.req.header("X-API-Key") ?? "";
    if (!validKeys.has(key)) {
      throw new HTTPException(401, { message: "Invalid or missing API key" });
    }

    return next();
  });
}
