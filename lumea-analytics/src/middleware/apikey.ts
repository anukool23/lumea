import { createMiddleware } from "hono/factory";

const EXEMPT = new Set(["/health", "/docs", "/openapi.json"]);

export function requireAPIKey() {
  return createMiddleware(async (c, next) => {
    if (EXEMPT.has(c.req.path)) return next();

    const raw = process.env.API_KEYS ?? "";
    if (!raw) return next(); // no keys configured — open in dev

    const validKeys = new Set(raw.split("-").filter(Boolean));
    const provided = c.req.header("X-API-Key") ?? "";

    if (!validKeys.has(provided)) {
      return c.json({ error: "Invalid or missing API key" }, 401);
    }

    return next();
  });
}
