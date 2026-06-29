import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types/env.d";
import { requireAuth } from "../middleware/auth";
import { PostService, NotFoundError, ForbiddenError, BadRequestError } from "../services/post.service";
import { PostRepository } from "../repository/post.repository";
import { getDb } from "../lib/mongodb";
import {
  CreatePostSchema,
  UpdatePostSchema,
  PostResponseSchema,
  PostListResponseSchema,
  MessageResponseSchema,
  ErrorResponseSchema,
  TogglePremiumSchema,
  UpdateCoverSchema,
  PublishPostSchema,
} from "../models/post";

const app = new OpenAPIHono<AppEnv>();

// ── Dependency factory (per-request, cached mongo client) ─────────────────────

async function getService(mongoUri: string): Promise<PostService> {
  const db = await getDb(mongoUri);
  const repo = new PostRepository(db);
  return new PostService(repo);
}

// ── Error handler helper ──────────────────────────────────────────────────────

function handleError(err: unknown): never {
  if (err instanceof NotFoundError) throw new HTTPException(404, { message: err.message });
  if (err instanceof ForbiddenError) throw new HTTPException(403, { message: err.message });
  if (err instanceof BadRequestError) throw new HTTPException(400, { message: err.message });
  throw new HTTPException(500, { message: "Internal server error" });
}

// ── Common param schemas ──────────────────────────────────────────────────────

const PostIdParam = z.object({ postId: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }) });
const PaginationQuery = z.object({
  page: z.string().pipe(z.coerce.number().int().min(1)).default("1").openapi({ example: "1" }),
  limit: z.string().pipe(z.coerce.number().int().min(1).max(50)).default("20").openapi({ example: "20" }),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED"]).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts — Create post
// ─────────────────────────────────────────────────────────────────────────────

const createPostRoute = createRoute({
  method: "post",
  path: "/api/posts",
  tags: ["Posts"],
  summary: "Create a post",
  description: "Creates a new post as DRAFT or SCHEDULED. Content is HTML from Tiptap editor.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: CreatePostSchema } }, required: true },
  },
  responses: {
    201: { description: "Post created", content: { "application/json": { schema: PostResponseSchema } } },
    400: { description: "Validation error", content: { "application/json": { schema: ErrorResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.use("/api/posts", requireAuth);
app.openapi(createPostRoute, async (c) => {
  const user = c.get("user");
  const input = c.req.valid("json");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.createPost(input, user.user_id, user.username, user.username);
    return c.json(post, 201);
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts — Get my posts
// ─────────────────────────────────────────────────────────────────────────────

const getMyPostsRoute = createRoute({
  method: "get",
  path: "/api/posts",
  tags: ["Posts"],
  summary: "Get my posts",
  description: "Returns paginated list of the authenticated author's posts. Filter by status.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: { query: PaginationQuery },
  responses: {
    200: { description: "Post list", content: { "application/json": { schema: PostListResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(getMyPostsRoute, async (c) => {
  const user = c.get("user");
  const { page, limit, status } = c.req.valid("query");

  const svc = await getService(process.env.MONGODB_URI!);
  const result = await svc.getMyPosts(user.user_id, page, limit, status);
  return c.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/stats — Writer stats
// ─────────────────────────────────────────────────────────────────────────────

const getStatsRoute = createRoute({
  method: "get",
  path: "/api/posts/stats",
  tags: ["Posts"],
  summary: "Writer post stats",
  description: "Returns aggregate stats: total posts, views, likes, comments.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  responses: {
    200: {
      description: "Stats",
      content: {
        "application/json": {
          schema: z.object({
            totalPosts: z.number(),
            publishedPosts: z.number(),
            draftPosts: z.number(),
            totalViews: z.number(),
            totalLikes: z.number(),
            totalComments: z.number(),
          }).openapi("WriterStats"),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(getStatsRoute, async (c) => {
  const user = c.get("user");
  const svc = await getService(process.env.MONGODB_URI!);
  const stats = await svc.getStats(user.user_id);
  return c.json(stats);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/:postId — Get single post
// ─────────────────────────────────────────────────────────────────────────────

const getPostRoute = createRoute({
  method: "get",
  path: "/api/posts/{postId}",
  tags: ["Posts"],
  summary: "Get a post",
  description: "Returns a post. Drafts are only visible to the author.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: { params: PostIdParam },
  responses: {
    200: { description: "Post", content: { "application/json": { schema: PostResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.use("/api/posts/:postId", requireAuth);
app.openapi(getPostRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.getPost(postId, user.user_id);
    return c.json(post);
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/posts/:postId — Update post
// ─────────────────────────────────────────────────────────────────────────────

const updatePostRoute = createRoute({
  method: "put",
  path: "/api/posts/{postId}",
  tags: ["Posts"],
  summary: "Update a post",
  description: "Updates post content, tags, cover image, etc. All fields are optional.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: {
    params: PostIdParam,
    body: { content: { "application/json": { schema: UpdatePostSchema } }, required: true },
  },
  responses: {
    200: { description: "Updated post", content: { "application/json": { schema: PostResponseSchema } } },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(updatePostRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");
  const input = c.req.valid("json");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.updatePost(postId, user.user_id, input);
    return c.json(post);
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:postId — Delete post
// ─────────────────────────────────────────────────────────────────────────────

const deletePostRoute = createRoute({
  method: "delete",
  path: "/api/posts/{postId}",
  tags: ["Posts"],
  summary: "Delete a post",
  description: "Permanently deletes a post. This action cannot be undone.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: { params: PostIdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: MessageResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(deletePostRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    await svc.deletePost(postId, user.user_id);
    return c.json({ message: "Post deleted successfully" });
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:postId/publish — Publish post
// ─────────────────────────────────────────────────────────────────────────────

const publishPostRoute = createRoute({
  method: "post",
  path: "/api/posts/{postId}/publish",
  tags: ["Posts"],
  summary: "Publish a post",
  description: "Publishes a DRAFT or SCHEDULED post immediately. Pass scheduledAt to schedule instead.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: {
    params: PostIdParam,
    body: {
      content: { "application/json": { schema: PublishPostSchema ?? z.object({ scheduledAt: z.string().datetime().optional() }).optional() } },
      required: false,
    },
  },
  responses: {
    200: { description: "Published post", content: { "application/json": { schema: PostResponseSchema } } },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(publishPostRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");

  let scheduledAt: string | undefined;
  try {
    const body = await c.req.json().catch(() => ({}));
    scheduledAt = body?.scheduledAt;
  } catch {}

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.publishPost(postId, user.user_id, scheduledAt);
    return c.json(post);
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:postId/unpublish — Unpublish post
// ─────────────────────────────────────────────────────────────────────────────

const unpublishPostRoute = createRoute({
  method: "post",
  path: "/api/posts/{postId}/unpublish",
  tags: ["Posts"],
  summary: "Unpublish a post",
  description: "Moves a PUBLISHED post back to DRAFT.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: { params: PostIdParam },
  responses: {
    200: { description: "Unpublished post", content: { "application/json": { schema: PostResponseSchema } } },
    400: { description: "Post not published", content: { "application/json": { schema: ErrorResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(unpublishPostRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.unpublishPost(postId, user.user_id);
    return c.json(post);
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/posts/:postId/premium — Toggle premium
// ─────────────────────────────────────────────────────────────────────────────

const togglePremiumRoute = createRoute({
  method: "patch",
  path: "/api/posts/{postId}/premium",
  tags: ["Posts"],
  summary: "Toggle premium gate",
  description: "Locks or unlocks a post behind the supporter paywall.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: {
    params: PostIdParam,
    body: { content: { "application/json": { schema: TogglePremiumSchema } }, required: true },
  },
  responses: {
    200: { description: "Updated post", content: { "application/json": { schema: PostResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(togglePremiumRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");
  const { isPremium } = c.req.valid("json");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.togglePremium(postId, user.user_id, isPremium);
    return c.json(post);
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/posts/:postId/cover — Update cover image
// ─────────────────────────────────────────────────────────────────────────────

const updateCoverRoute = createRoute({
  method: "patch",
  path: "/api/posts/{postId}/cover",
  tags: ["Posts"],
  summary: "Update cover image",
  description: "Sets the cover image URL (Cloudinary CDN URL from Media Service).",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: {
    params: PostIdParam,
    body: { content: { "application/json": { schema: UpdateCoverSchema } }, required: true },
  },
  responses: {
    200: { description: "Updated post", content: { "application/json": { schema: PostResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(updateCoverRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");
  const { coverImage } = c.req.valid("json");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.updateCover(postId, user.user_id, coverImage);
    return c.json(post);
  } catch (err) {
    handleError(err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:postId/archive — Archive post
// ─────────────────────────────────────────────────────────────────────────────

const archivePostRoute = createRoute({
  method: "post",
  path: "/api/posts/{postId}/archive",
  tags: ["Posts"],
  summary: "Archive a post",
  description: "Moves a post to ARCHIVED status. Archived posts are not publicly visible.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  request: { params: PostIdParam },
  responses: {
    200: { description: "Archived post", content: { "application/json": { schema: PostResponseSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorResponseSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.openapi(archivePostRoute, async (c) => {
  const user = c.get("user");
  const { postId } = c.req.valid("param");

  const svc = await getService(process.env.MONGODB_URI!);
  try {
    const post = await svc.archivePost(postId, user.user_id);
    return c.json(post);
  } catch (err) {
    handleError(err);
  }
});

export default app;
