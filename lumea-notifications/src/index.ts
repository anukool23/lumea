import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";
import type { AppEnv } from "./types/env.d";
import { requireAPIKey } from "./middleware/apikey";
import { requestLogger } from "./middleware/request-logger";
import { logger } from "./lib/logger";
import notificationsRouter from "./routes/notifications";

const app = new OpenAPIHono<AppEnv>();

// ── Register security schemes ─────────────────────────────────────────────────

app.openAPIRegistry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "JWT issued by lumea-auth",
});

app.openAPIRegistry.registerComponent("securitySchemes", "APIKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "X-API-Key",
  description: "BFF API key — one of the keys from API_KEYS env (split on '-')",
});

app.openAPIRegistry.registerComponent("securitySchemes", "InternalTokenAuth", {
  type: "apiKey",
  in: "header",
  name: "X-Internal-Token",
  description: "Shared secret for internal service-to-service calls",
});

// ── Global middleware ─────────────────────────────────────────────────────────

app.use("*", requestLogger);
app.use("*", requireAPIKey());
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = (
        process.env.ALLOWED_ORIGINS ??
        "http://localhost:3000,http://localhost:3001,https://lumea.ink,https://dash.lumea.ink"
      )
        .split(",")
        .map((o) => o.trim());
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Request-ID", "X-API-Key", "X-Internal-Token"],
    credentials: true,
    maxAge: 86400,
  })
);

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ status: "ok", service: "lumea-notifications", version: "1.0.0" })
);

// ── OpenAPI spec ──────────────────────────────────────────────────────────────

const serverUrl =
  process.env.SWAGGER_SERVER_URL ??
  `http://localhost:${process.env.PORT ?? "8793"}`;

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Lumea Notification Service",
    version: "1.0.0",
    description:
      "In-app notifications for Lumea users. Public routes require JWT + API key. Internal routes require X-Internal-Token.",
  },
  servers: [
    { url: serverUrl, description: "Active server" },
    { url: "http://localhost:8793", description: "Local dev" },
  ],
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// ── Routes ────────────────────────────────────────────────────────────────────

app.route("/", notificationsRouter);

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
  "lumea-notifications starting"
);

// ── Exports ───────────────────────────────────────────────────────────────────

export const handler = handle(app);
export default app;
