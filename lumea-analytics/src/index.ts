import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";
import { Client } from "@opensearch-project/opensearch";
import { MongoClient, Db } from "mongodb";

// ── Clients ───────────────────────────────────────────────────────────────────
let _os: Client | null = null;
const getOS = () => {
  if (!_os) _os = new Client({ node: process.env.OPENSEARCH_URL!, auth: { username: process.env.OPENSEARCH_USERNAME!, password: process.env.OPENSEARCH_PASSWORD! } });
  return _os;
};

let _mongo: MongoClient | null = null;
async function getDb(): Promise<Db> {
  if (!_mongo) { _mongo = new MongoClient(process.env.MONGODB_URI!); await _mongo.connect(); }
  return _mongo.db("lumea");
}

// ── JWT verify ────────────────────────────────────────────────────────────────
async function verifyJWT(header: string | undefined): Promise<{ user_id: string; username: string } | null> {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const [h, p, s] = header.slice(7).split(".");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(process.env.JWT_SECRET!), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const decode = (str: string) => { const pad = str + "=".repeat((4 - str.length % 4) % 4); const b = atob(pad.replace(/-/g, "+").replace(/_/g, "/")); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    const ok = await crypto.subtle.verify("HMAC", key, decode(s), enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const pl = JSON.parse(new TextDecoder().decode(decode(p)));
    return pl.exp > Date.now() / 1000 ? pl : null;
  } catch { return null; }
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = new OpenAPIHono();
const _apiKeys = new Set((process.env.API_KEYS ?? "").split("-").filter(Boolean));
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || _apiKeys.size === 0) return next();
  if (!_apiKeys.has(c.req.header("X-API-Key") ?? "")) return c.json({ error: "Invalid or missing API key" }, 401);
  return next();
});
app.use("*", logger());
app.use("*", cors({ origin: ["http://localhost:3000", "http://localhost:3001", "https://lumea.ink", "https://dash.lumea.ink"], allowHeaders: ["Authorization", "Content-Type"], credentials: true }));
app.get("/health", (c) => c.json({ status: "ok", service: "lumea-analytics" }));

const E = z.object({ error: z.string() });

// ── POST /api/analytics/events — ingest event ─────────────────────────────────
const EventSchema = z.object({
  post_id: z.string(),
  event_type: z.enum(["view", "read", "like", "comment", "share"]),
  reading_time_sec: z.number().int().optional(),
  percentage_read: z.number().min(0).max(100).optional(),
  referrer: z.string().optional(),
}).openapi("AnalyticsEvent");

app.openapi(createRoute({
  method: "post", path: "/api/analytics/events", tags: ["Analytics"],
  summary: "Record analytics event",
  description: "Called by Content Service on view/read milestones. User ID from JWT if present.",
  request: { body: { content: { "application/json": { schema: EventSchema } }, required: true } },
  responses: { 202: { description: "Accepted", content: { "application/json": { schema: z.object({ message: z.string() }) } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  const body = c.req.valid("json");

  await getOS().index({
    index: "analytics",
    body: {
      ...body,
      user_id: user?.user_id ?? null,
      timestamp: new Date().toISOString(),
    },
  });
  return c.json({ message: "Event recorded" }, 202);
});

// ── GET /api/analytics/overview — writer overview stats ──────────────────────
app.openapi(createRoute({
  method: "get", path: "/api/analytics/overview", tags: ["Analytics"],
  summary: "Writer analytics overview",
  description: "Returns total views, reads, likes, comments and follower count for the authenticated writer.",
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      period: z.enum(["7d", "30d", "90d", "all"]).default("30d"),
    }),
  },
  responses: {
    200: {
      description: "Overview stats",
      content: {
        "application/json": {
          schema: z.object({
            totalViews: z.number(), totalReads: z.number(), totalLikes: z.number(),
            totalComments: z.number(), avgReadPercentage: z.number(),
            topPost: z.object({ postId: z.string(), title: z.string(), views: z.number() }).nullable(),
          }).openapi("AnalyticsOverview"),
        },
      },
    },
  },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { period } = c.req.valid("query");

  const periodMap: Record<string, string> = { "7d": "now-7d/d", "30d": "now-30d/d", "90d": "now-90d/d", "all": "2020-01-01" };
  const gte = periodMap[period];

  // Get author's post IDs from MongoDB
  const db = await getDb();
  const posts = await db.collection("posts").find({ authorId: user.user_id, status: "PUBLISHED" }, { projection: { postId: 1, title: 1 } }).toArray();
  const postIds = posts.map((p: any) => p.postId);

  if (postIds.length === 0) return c.json({ totalViews: 0, totalReads: 0, totalLikes: 0, totalComments: 0, avgReadPercentage: 0, topPost: null });

  const res = await getOS().search({
    index: "analytics",
    body: {
      size: 0,
      query: { bool: { filter: [{ terms: { post_id: postIds } }, { range: { timestamp: { gte } } }] } },
      aggs: {
        by_event: { terms: { field: "event_type", size: 10 } },
        avg_read_pct: { avg: { field: "percentage_read" } },
        top_post: { terms: { field: "post_id", size: 1, order: { _count: "desc" } } },
      },
    },
  });

  const buckets: any[] = res.body.aggregations?.by_event?.buckets ?? [];
  const count = (type: string) => buckets.find((b: any) => b.key === type)?.doc_count ?? 0;

  const topPostId = res.body.aggregations?.top_post?.buckets?.[0]?.key;
  const topPostMeta = topPostId ? posts.find((p: any) => p.postId === topPostId) : null;

  return c.json({
    totalViews: count("view"),
    totalReads: count("read"),
    totalLikes: count("like"),
    totalComments: count("comment"),
    avgReadPercentage: Math.round(res.body.aggregations?.avg_read_pct?.value ?? 0),
    topPost: topPostMeta ? { postId: topPostMeta.postId, title: topPostMeta.title, views: count("view") } : null,
  });
});

// ── GET /api/analytics/posts — per-post breakdown ────────────────────────────
app.openapi(createRoute({
  method: "get", path: "/api/analytics/posts", tags: ["Analytics"],
  summary: "Per-post analytics",
  security: [{ BearerAuth: [] }],
  request: { query: z.object({ period: z.enum(["7d", "30d", "90d", "all"]).default("30d") }) },
  responses: {
    200: {
      description: "Per-post stats",
      content: {
        "application/json": {
          schema: z.array(z.object({
            postId: z.string(), title: z.string(), views: z.number(),
            reads: z.number(), likes: z.number(), comments: z.number(), avgReadPct: z.number(),
          })).openapi("PostAnalyticsList"),
        },
      },
    },
  },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { period } = c.req.valid("query");
  const periodMap: Record<string, string> = { "7d": "now-7d/d", "30d": "now-30d/d", "90d": "now-90d/d", "all": "2020-01-01" };

  const db = await getDb();
  const posts = await db.collection("posts").find({ authorId: user.user_id, status: "PUBLISHED" }, { projection: { postId: 1, title: 1 } }).toArray();
  const postIds = posts.map((p: any) => p.postId);
  if (postIds.length === 0) return c.json([]);

  const res = await getOS().search({
    index: "analytics",
    body: {
      size: 0,
      query: { bool: { filter: [{ terms: { post_id: postIds } }, { range: { timestamp: { gte: periodMap[period] } } }] } },
      aggs: {
        by_post: {
          terms: { field: "post_id", size: 500 },
          aggs: {
            by_event: { terms: { field: "event_type", size: 10 } },
            avg_read_pct: { avg: { field: "percentage_read" } },
          },
        },
      },
    },
  });

  const result = (res.body.aggregations?.by_post?.buckets ?? []).map((bucket: any) => {
    const eventBuckets: any[] = bucket.by_event?.buckets ?? [];
    const count = (type: string) => eventBuckets.find((b: any) => b.key === type)?.doc_count ?? 0;
    const meta = posts.find((p: any) => p.postId === bucket.key);
    return {
      postId: bucket.key,
      title: meta?.title ?? "Unknown",
      views: count("view"),
      reads: count("read"),
      likes: count("like"),
      comments: count("comment"),
      avgReadPct: Math.round(bucket.avg_read_pct?.value ?? 0),
    };
  });

  return c.json(result);
});

// ── OpenAPI ───────────────────────────────────────────────────────────────────
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Lumea Analytics Service", version: "1.0.0" },
  components: { securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
});
app.get("/docs", swaggerUI({ url: "/openapi.json" }));
app.onError((err, c) => err instanceof HTTPException ? c.json({ error: err.message }, err.status) : c.json({ error: "Internal error" }, 500));

export const handler = handle(app);
export default app;
