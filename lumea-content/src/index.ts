import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";

import feedRouter from "./routes/feed";
import postsRouter from "./routes/posts";
import searchRouter from "./routes/search";

const app = new OpenAPIHono();

// ── API key validation ────────────────────────────────────────────────────────
// Keys are stored as API_KEYS=key1-key2-key3-key4 (split on "-")
const _apiKeys = new Set((process.env.API_KEYS ?? "").split("-").filter(Boolean));
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || _apiKeys.size === 0) return next();
  if (!_apiKeys.has(c.req.header("X-API-Key") ?? "")) {
    return c.json({ error: "Invalid or missing API key" }, 401);
  }
  return next();
});

// ── Global middleware ─────────────────────────────────────────────────────────

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://lumea.ink",
      "https://dash.lumea.ink",
    ],
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    credentials: true,
    maxAge: 86400,
  })
);

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ status: "ok", service: "lumea-content", version: "1.0.0" })
);

// ── OpenAPI + Swagger UI ──────────────────────────────────────────────────────

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Lumea Content Service",
    version: "1.0.0",
    description:
      "Public reader-facing API — feeds, post detail, full-text search. CQRS read side.",
  },
  servers: [
    { url: "http://localhost:8788", description: "Local dev" },
    { url: "https://api.lumea.ink", description: "Production (AWS API Gateway)" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Optional — unlocks premium content for active supporters",
      },
    },
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// ── Routes ────────────────────────────────────────────────────────────────────

app.route("/", feedRouter);
app.route("/", postsRouter);
app.route("/", searchRouter);

// ── Error handling ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("[content-service] unhandled:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// ── Lambda export (production) ────────────────────────────────────────────────
export const handler = handle(app);

// Default export for local dev
export default app;
