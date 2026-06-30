import { createMiddleware } from "hono/factory";
import { childLogger } from "../lib/logger";

export const requestLogger = createMiddleware(async (c, next) => {
  const requestId =
    c.req.header("X-Request-ID") ?? crypto.randomUUID();
  const log = childLogger(requestId);
  const start = Date.now();

  c.res.headers.set("X-Request-ID", requestId);

  log.info(
    { method: c.req.method, path: c.req.path },
    "→ request"
  );

  await next();

  const status = c.res.status;
  const ms = Date.now() - start;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  log[level](
    { method: c.req.method, path: c.req.path, status, ms },
    "← response"
  );
});
