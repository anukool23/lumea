import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { getDb } from "../lib/mongodb";
import { ContentPostRepository } from "../repository/post.repository";
import { toPublicPost } from "../services/content.service";
import { FeedService } from "../services/feed.service";
import { getRedis } from "../lib/redis";
import { optionalAuth } from "../middleware/auth";
import { PublicPostSchema, ErrorResponseSchema } from "../models/content";

const app = new OpenAPIHono();

function getRepo() {
  return async () => {
    const db = await getDb(process.env.MONGODB_URI!);
    return new ContentPostRepository(db);
  };
}

// ── GET /api/posts/:postId — get post by ID ────────────────────────────────────

const getPostByIdRoute = createRoute({
  method: "get",
  path: "/api/posts/{postId}",
  tags: ["Posts"],
  summary: "Get post by ID",
  description:
    "Returns a published post by UUID. Premium posts return truncated content unless requester has an active supporter plan.",
  request: {
    params: z.object({ postId: z.string().uuid() }),
  },
  responses: {
    200: { description: "Post", content: { "application/json": { schema: PublicPostSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.use("/api/posts/:postId", optionalAuth);
app.openapi(getPostByIdRoute, async (c) => {
  const { postId } = c.req.valid("param");
  const viewer = c.get("user");
  const repo = await getRepo()();

  const doc = await repo.findPublishedById(postId);
  if (!doc) throw new HTTPException(404, { message: "Post not found" });

  return c.json(toPublicPost(doc, viewer));
});

// ── GET /api/posts/by-slug/:slug — get post by slug ───────────────────────────

const getPostBySlugRoute = createRoute({
  method: "get",
  path: "/api/posts/by-slug/{slug}",
  tags: ["Posts"],
  summary: "Get post by slug",
  description: "Returns a published post by slug. Optionally pass `?author=username` to disambiguate.",
  request: {
    params: z.object({ slug: z.string() }),
    query: z.object({ author: z.string().optional() }),
  },
  responses: {
    200: { description: "Post", content: { "application/json": { schema: PublicPostSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.use("/api/posts/by-slug/:slug", optionalAuth);
app.openapi(getPostBySlugRoute, async (c) => {
  const { slug } = c.req.valid("param");
  const { author } = c.req.valid("query");
  const viewer = c.get("user");
  const repo = await getRepo()();

  const doc = await repo.findPublishedBySlug(slug, author);
  if (!doc) throw new HTTPException(404, { message: "Post not found" });

  return c.json(toPublicPost(doc, viewer));
});

// ── GET /api/posts/:postId/related — related posts ────────────────────────────

const getRelatedRoute = createRoute({
  method: "get",
  path: "/api/posts/{postId}/related",
  tags: ["Posts"],
  summary: "Related posts",
  description: "Returns up to 5 published posts with overlapping tags.",
  request: {
    params: z.object({ postId: z.string().uuid() }),
  },
  responses: {
    200: { description: "Related posts", content: { "application/json": { schema: z.array(PublicPostSchema) } } },
    404: { description: "Post not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.use("/api/posts/:postId/related", optionalAuth);
app.openapi(getRelatedRoute, async (c) => {
  const { postId } = c.req.valid("param");
  const viewer = c.get("user");

  const db = await getDb(process.env.MONGODB_URI!);
  const redis = getRedis(process.env.UPSTASH_REDIS_URL!, process.env.UPSTASH_REDIS_TOKEN!);
  const repo = new ContentPostRepository(db);

  const post = await repo.findPublishedById(postId);
  if (!post) throw new HTTPException(404, { message: "Post not found" });

  const svc = new FeedService(
    repo,
    redis,
    process.env.AUTH_SERVICE_URL!,
    process.env.INTERNAL_SERVICE_TOKEN!
  );
  const related = await svc.getRelated(postId, post.tags, viewer);
  return c.json(related);
});

// ── GET /api/users/:username/posts — author's public posts ───────────────────

const getAuthorPostsRoute = createRoute({
  method: "get",
  path: "/api/users/{username}/posts",
  tags: ["Posts"],
  summary: "Author's published posts",
  description: "Returns paginated published posts for a given author username.",
  request: {
    params: z.object({ username: z.string() }),
    query: z.object({
      page: z.string().pipe(z.coerce.number().int().min(1)).default("1"),
      limit: z.string().pipe(z.coerce.number().int().min(1).max(30)).default("20"),
    }),
  },
  responses: {
    200: {
      description: "Author posts",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(PublicPostSchema),
            total: z.number(),
            page: z.number(),
            hasMore: z.boolean(),
          }),
        },
      },
    },
  },
});

app.use("/api/users/:username/posts", optionalAuth);
app.openapi(getAuthorPostsRoute, async (c) => {
  const { username } = c.req.valid("param");
  const { page, limit } = c.req.valid("query");
  const viewer = c.get("user");
  const repo = await getRepo()();

  const { data, total } = await repo.findByAuthor(username, page, limit);
  return c.json({
    data: data.map((d) => toPublicPost(d, viewer)),
    total,
    page,
    hasMore: page * limit < total,
  });
});

export default app;
