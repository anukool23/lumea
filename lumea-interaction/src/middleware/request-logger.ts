import { createMiddleware } from "hono/factory";
import { childLogger } from "../lib/logger";

export const requestLogger = createMiddleware(async (c, next) => {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  c.header("X-Request-ID", requestId);

  await next();

  const latency = Date.now() - start;
  const status = c.res.status;
  const log = childLogger(requestId);

  const logFn =
    status >= 500 ? log.error.bind(log)
    : status >= 400 ? log.warn.bind(log)
    : log.info.bind(log);

  logFn(
    {
      method: c.req.method,
      path: c.req.path,
      status,
      latency_ms: latency,
      ip:
        c.req.header("x-forwarded-for") ??
        c.req.header("x-real-ip") ??
        "unknown",
      user_agent: c.req.header("user-agent"),
      component: "http",
    },
    "request"
  );
});
