import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";
import type { AppEnv } from "./types/env.d";
import { requireInternalToken } from "./middleware/internal-auth";
import { requestLogger } from "./middleware/request-logger";
import { logger } from "./lib/logger";
import emailsRouter from "./routes/emails";

const app = new OpenAPIHono<AppEnv>();

// ── Global middleware ─────────────────────────────────────────────────────────

app.use("*", requestLogger);
app.use("*", requireInternalToken());
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = (
        process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:3001"
      )
        .split(",")
        .map((o) => o.trim());
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "X-Request-ID", "X-Internal-Token"],
    maxAge: 86400,
  })
);

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ status: "ok", service: "lumea-comms", version: "1.0.0" })
);

// ── OpenAPI spec ──────────────────────────────────────────────────────────────

const serverUrl =
  process.env.SWAGGER_SERVER_URL ??
  `http://localhost:${process.env.PORT ?? "8791"}`;

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Lumea Communication Service",
    version: "1.0.0",
    description:
      "Internal email service. All /internal/* routes require `X-Internal-Token` header.",
  },
  servers: [
    { url: serverUrl, description: "Active server" },
    { url: "http://localhost:8791", description: "Local dev" },
  ],
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// ── Routes ────────────────────────────────────────────────────────────────────

app.route("/", emailsRouter);

// ── Error handler ─────────────────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  logger.error({ err, path: c.req.path, method: c.req.method }, "unhandled error");
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Route not found" }, 404));

// ── Startup log ───────────────────────────────────────────────────────────────

logger.info(
  { server: serverUrl, swagger: `${serverUrl}/docs` },
  "lumea-comms starting"
);

// ── Exports ───────────────────────────────────────────────────────────────────

export const handler = handle(app);
export default app;
