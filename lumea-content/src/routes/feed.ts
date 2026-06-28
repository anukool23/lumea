import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../lib/mongodb";
import { getRedis } from "../lib/redis";
import { ContentPostRepository } from "../repository/post.repository";
import { FeedService } from "../services/feed.service";
import { optionalAuth, requireAuth } from "../middleware/auth";
import {
  FeedResponseSchema,
  FeedQuerySchema,
  ErrorResponseSchema,
  PublicPostSchema,
} from "../models/content";

const app = new OpenAPIHono();

function getFeedService() {
  return async () => {
    const db = await getDb(process.env.MONGODB_URI!);
    const redis = getRedis(process.env.UPSTASH_REDIS_URL!, process.env.UPSTASH_REDIS_TOKEN!);
    const repo = new ContentPostRepository(db);
    return new FeedService(
      repo,
      redis,
      process.env.AUTH_SERVICE_URL!,
      process.env.INTERNAL_SERVICE_TOKEN!
    );
  };
}

// ── GET /api/feed — main feed ─────────────────────────────────────────────────

const feedRoute = createRoute({
  method: "get",
  path: "/api/feed",
  tags: ["Feed"],
  summary: "Get post feed",
  description:
    "Returns a post feed. `type=following` requires auth and returns posts from followed authors. `type=trending` uses the decay formula. `type=explore` is all published posts.",
  request: { query: FeedQuerySchema },
  responses: {
    200: { description: "Feed", content: { "application/json": { schema: FeedResponseSchema } } },
  },
});

app.use("/api/feed", optionalAuth);
app.openapi(feedRoute, async (c) => {
  const { page, limit, type, category, tag } = c.req.valid("query");
  const viewer = c.get("user");

  const svc = await getFeedService()();

  let result: { data: any[]; total: number };

  if (type === "following") {
    if (!viewer) throw new HTTPException(401, { message: "Login to see your following feed" });
    result = await svc.getFollowingFeed(viewer.user_id, page, limit, viewer);
  } else if (type === "trending") {
    result = await svc.getTrending(page, limit, viewer);
  } else {
    result = await svc.getExplore(page, limit, viewer, category, tag);
  }

  return c.json({
    ...result,
    page,
    hasMore: page * limit < result.total,
    feedType: type,
  });
});

// ── GET /api/feed/trending ────────────────────────────────────────────────────

const trendingRoute = createRoute({
  method: "get",
  path: "/api/feed/trending",
  tags: ["Feed"],
  summary: "Trending posts",
  description:
    "Returns trending posts scored by: `(views + likes×5 + comments×10) / (hoursSincePublish+2)^1.8`. Cached 10 min.",
  request: {
    query: z.object({
      page: z.string().pipe(z.coerce.number().int().min(1)).default("1"),
      limit: z.string().pipe(z.coerce.number().int().min(1).max(30)).default("20"),
    }),
  },
  responses: {
    200: { description: "Trending feed", content: { "application/json": { schema: FeedResponseSchema } } },
  },
});

app.use("/api/feed/trending", optionalAuth);
app.openapi(trendingRoute, async (c) => {
  const { page, limit } = c.req.valid("query");
  const viewer = c.get("user");
  const svc = await getFeedService()();
  const result = await svc.getTrending(page, limit, viewer);
  return c.json({ ...result, page, hasMore: page * limit < result.total, feedType: "trending" });
});

// ── GET /api/feed/following ───────────────────────────────────────────────────

const followingRoute = createRoute({
  method: "get",
  path: "/api/feed/following",
  tags: ["Feed"],
  summary: "Following feed",
  description: "Returns posts from authors the authenticated user follows. Requires auth.",
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().pipe(z.coerce.number().int().min(1)).default("1"),
      limit: z.string().pipe(z.coerce.number().int().min(1).max(30)).default("20"),
    }),
  },
  responses: {
    200: { description: "Following feed", content: { "application/json": { schema: FeedResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.use("/api/feed/following", requireAuth);
app.openapi(followingRoute, async (c) => {
  const { page, limit } = c.req.valid("query");
  const viewer = c.get("user")!;
  const svc = await getFeedService()();
  const result = await svc.getFollowingFeed(viewer.user_id, page, limit, viewer);
  return c.json({ ...result, page, hasMore: page * limit < result.total, feedType: "following" });
});

// ── GET /api/feed/tags — popular tags ─────────────────────────────────────────

const popularTagsRoute = createRoute({
  method: "get",
  path: "/api/feed/tags",
  tags: ["Feed"],
  summary: "Popular tags",
  description: "Returns the 30 most-used tags across all published posts.",
  responses: {
    200: {
      description: "Tag list",
      content: {
        "application/json": {
          schema: z.array(
            z.object({ tag: z.string(), count: z.number() }).openapi("TagCount")
          ),
        },
      },
    },
  },
});

app.openapi(popularTagsRoute, async (c) => {
  const svc = await getFeedService()();
  const tags = await svc.getPopularTags();
  return c.json(tags);
});

export default app;
