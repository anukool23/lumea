import { createMiddleware } from "hono/factory";
import { logger } from "../lib/logger";

export const REQUEST_ID_KEY = "requestId";

function generateRequestId(): string {
  // Use crypto.randomUUID() — available in Node 18+ and Lambda runtimes
  return crypto.randomUUID();
}

/**
 * Structured request logger middleware.
 * - Generates a UUID request_id per request
 * - Sets X-Request-ID response header for client correlation
 * - Logs method, path, status, latency_ms, ip, user_agent on completion
 * - 5xx → error, 4xx → warn, 2xx/3xx → info
 */
export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = c.req.header("X-Request-ID") ?? generateRequestId();
  const start = Date.now();

  // Make request_id available to downstream handlers
  c.set(REQUEST_ID_KEY as never, requestId);
  c.header("X-Request-ID", requestId);

  await next();

  const status = c.res.status;
  const latency = Date.now() - start;
  const child = logger.child({ request_id: requestId });

  const meta = {
    method: c.req.method,
    path: c.req.path,
    status,
    latency_ms: latency,
    ip: c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip") ?? "unknown",
    user_agent: c.req.header("user-agent") ?? "",
    component: "http",
  };

  if (status >= 500) {
    child.error(meta, "request");
  } else if (status >= 400) {
    child.warn(meta, "request");
  } else {
    child.info(meta, "request");
  }
});
