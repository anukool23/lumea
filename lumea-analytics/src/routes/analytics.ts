import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../types/env.d";
import { getOS, INDICES, PERIOD_MAP } from "../lib/opensearch";
import { getDb, COLLECTIONS } from "../lib/mongodb";
import { getAuthUser, tryGetAuthUser } from "../middleware/auth";

const router = new OpenAPIHono<AppEnv>();

// ── Shared schemas ────────────────────────────────────────────────────────────

const ErrorSchema   = z.object({ error: z.string() });
const MessageSchema = z.object({ message: z.string() });

const EventTypeEnum = z.enum(["view", "read", "like", "comment", "share"]);
const PeriodEnum    = z.enum(["7d", "30d", "90d", "all"]);

// ── POST /api/analytics/events — ingest event ─────────────────────────────────

const ingestEventRoute = createRoute({
  method: "post",
  path: "/api/analytics/events",
  tags: ["Analytics"],
  summary: "Record analytics event",
  description: "Called by lumea-post on view/read milestones. JWT is optional — user_id attached if present.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            post_id:          z.string(),
            event_type:       EventTypeEnum,
            reading_time_sec: z.number().int().nonnegative().optional(),
            percentage_read:  z.number().min(0).max(100).optional(),
            referrer:         z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    202: { description: "Accepted",    content: { "application/json": { schema: MessageSchema } } },
    500: { description: "Index error", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const ingestEventHandler: RouteHandler<typeof ingestEventRoute, AppEnv> = async (c) => {
  const user = await tryGetAuthUser(c);
  const body = c.req.valid("json");

  await getOS().index({
    index: INDICES.ANALYTICS,
    body: {
      ...body,
      user_id:   user?.user_id ?? null,
      username:  user?.username ?? null,
      timestamp: new Date().toISOString(),
    },
  });

  return c.json({ message: "Event recorded" }, 202);
};

router.openapi(ingestEventRoute, ingestEventHandler);

// ── GET /api/analytics/overview ───────────────────────────────────────────────

const OverviewSchema = z.object({
  totalViews:        z.number(),
  totalReads:        z.number(),
  totalLikes:        z.number(),
  totalComments:     z.number(),
  avgReadPercentage: z.number(),
  topPost: z.object({
    postId: z.string(),
    title:  z.string(),
    views:  z.number(),
  }).nullable(),
});

const overviewRoute = createRoute({
  method: "get",
  path: "/api/analytics/overview",
  tags: ["Analytics"],
  summary: "Writer analytics overview",
  description: "Total views, reads, likes, comments and top post for the authenticated writer.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    query: z.object({ period: PeriodEnum.default("30d") }),
  },
  responses: {
    200: { description: "Overview stats", content: { "application/json": { schema: OverviewSchema } } },
    401: { description: "Unauthorized",   content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const overviewHandler: RouteHandler<typeof overviewRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { period } = c.req.valid("query");

  const db = await getDb();
  const posts = await db
    .collection(COLLECTIONS.POSTS)
    .find(
      { authorId: user.user_id, status: "PUBLISHED" },
      { projection: { postId: 1, title: 1 } }
    )
    .toArray();

  const postIds = posts.map((p) => p["postId"] as string);
  if (postIds.length === 0) {
    return c.json({ totalViews: 0, totalReads: 0, totalLikes: 0, totalComments: 0, avgReadPercentage: 0, topPost: null }, 200);
  }

  const res = await getOS().search({
    index: INDICES.ANALYTICS,
    body: {
      size: 0,
      query: {
        bool: {
          filter: [
            { terms: { post_id: postIds } },
            { range: { timestamp: { gte: PERIOD_MAP[period] } } },
          ],
        },
      },
      aggs: {
        by_event:     { terms: { field: "event_type", size: 10 } },
        avg_read_pct: { avg:   { field: "percentage_read" } },
        top_post:     { terms: { field: "post_id", size: 1, order: { _count: "desc" } } },
      },
    },
  });

  const aggs       = res.body.aggregations as Record<string, unknown>;
  const buckets    = (aggs?.["by_event"] as { buckets: Array<{ key: string; doc_count: number }> })?.buckets ?? [];
  const count      = (type: string) => buckets.find((b) => b.key === type)?.doc_count ?? 0;
  const topPostId  = ((aggs?.["top_post"] as { buckets: Array<{ key: string }> })?.buckets ?? [])[0]?.key;
  const topPostDoc = topPostId ? posts.find((p) => p["postId"] === topPostId) : null;

  return c.json({
    totalViews:        count("view"),
    totalReads:        count("read"),
    totalLikes:        count("like"),
    totalComments:     count("comment"),
    avgReadPercentage: Math.round(((aggs?.["avg_read_pct"] as { value: number })?.value) ?? 0),
    topPost: topPostDoc
      ? { postId: topPostDoc["postId"] as string, title: topPostDoc["title"] as string, views: count("view") }
      : null,
  }, 200);
};

router.openapi(overviewRoute, overviewHandler);

// ── GET /api/analytics/posts — per-post breakdown ────────────────────────────

const PostStatSchema = z.object({
  postId:     z.string(),
  title:      z.string(),
  views:      z.number(),
  reads:      z.number(),
  likes:      z.number(),
  comments:   z.number(),
  avgReadPct: z.number(),
});

const postsRoute = createRoute({
  method: "get",
  path: "/api/analytics/posts",
  tags: ["Analytics"],
  summary: "Per-post analytics breakdown",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    query: z.object({ period: PeriodEnum.default("30d") }),
  },
  responses: {
    200: { description: "Per-post stats", content: { "application/json": { schema: z.array(PostStatSchema) } } },
    401: { description: "Unauthorized",   content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const postsHandler: RouteHandler<typeof postsRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { period } = c.req.valid("query");

  const db = await getDb();
  const posts = await db
    .collection(COLLECTIONS.POSTS)
    .find(
      { authorId: user.user_id, status: "PUBLISHED" },
      { projection: { postId: 1, title: 1 } }
    )
    .toArray();

  const postIds = posts.map((p) => p["postId"] as string);
  if (postIds.length === 0) return c.json([], 200);

  const res = await getOS().search({
    index: INDICES.ANALYTICS,
    body: {
      size: 0,
      query: {
        bool: {
          filter: [
            { terms: { post_id: postIds } },
            { range: { timestamp: { gte: PERIOD_MAP[period] } } },
          ],
        },
      },
      aggs: {
        by_post: {
          terms: { field: "post_id", size: 500 },
          aggs: {
            by_event:     { terms: { field: "event_type", size: 10 } },
            avg_read_pct: { avg:   { field: "percentage_read" } },
          },
        },
      },
    },
  });

  type PostBucket = {
    key: string;
    by_event: { buckets: Array<{ key: string; doc_count: number }> };
    avg_read_pct: { value: number };
  };

  const aggs       = res.body.aggregations as Record<string, unknown>;
  const postBuckets: PostBucket[] = (aggs?.["by_post"] as { buckets: PostBucket[] })?.buckets ?? [];

  const result = postBuckets.map((bucket) => {
    const eventBuckets = bucket.by_event?.buckets ?? [];
    const count = (type: string) => eventBuckets.find((b) => b.key === type)?.doc_count ?? 0;
    const meta  = posts.find((p) => p["postId"] === bucket.key);
    return {
      postId:     bucket.key,
      title:      (meta?.["title"] as string) ?? "Unknown",
      views:      count("view"),
      reads:      count("read"),
      likes:      count("like"),
      comments:   count("comment"),
      avgReadPct: Math.round(bucket.avg_read_pct?.value ?? 0),
    };
  });

  return c.json(result, 200);
};

router.openapi(postsRoute, postsHandler);

export default router;
