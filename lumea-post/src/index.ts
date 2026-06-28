import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";
import type { AppEnv } from "./types/env.d";
import { requireAPIKey } from "./middleware/apikey";
import postsRouter from "./routes/posts";

const app = new OpenAPIHono<AppEnv>();

// ── Global middleware ─────────────────────────────────────────────────────────

app.use("*", logger());
app.use("*", requireAPIKey());

app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://lumea.ink",
        "https://dash.lumea.ink",
      ];
      return allowed.includes(origin) ? origin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Request-ID"],
    credentials: true,
    maxAge: 86400,
  })
);

// ── Health check ──────────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ status: "ok", service: "lumea-post", version: "1.0.0" })
);

// ── OpenAPI spec + Swagger UI ─────────────────────────────────────────────────

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Lumea Post Service",
    version: "1.0.0",
    description:
      "Post management for Lumea.ink writers — create, edit, publish, and manage blog posts.",
  },
  servers: [
    { url: "http://localhost:8787", description: "Local dev" },
    { url: "https://api.lumea.ink/post", description: "Production (AWS API Gateway)" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT issued by lumea-auth service",
      },
    },
  },
});

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// ── Routes ────────────────────────────────────────────────────────────────────

app.route("/", postsRouter);

// ── Global error handler ──────────────────────────────────────────────────────

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

app.notFound((c) => c.json({ error: "Route not found" }, 404));

// ── Exports ───────────────────────────────────────────────────────────────────

export const handler = handle(app);   // AWS Lambda
export default app;                   // local dev
