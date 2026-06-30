import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../types/env.d";
import { getAuthUser, tryGetAuthUser } from "../middleware/auth";
import { getDb, COLLECTIONS } from "../lib/mongodb";
import {
  PostIdParam,
  LikeStatusSchema,
  MessageSchema,
  ErrorSchema,
} from "../models/interaction";

const app = new OpenAPIHono<AppEnv>();

// ── POST /api/posts/:postId/like ───────────────────────────────────────────────

const likePostRoute = createRoute({
  method: "post",
  path: "/api/posts/{postId}/like",
  tags: ["Likes"],
  summary: "Like a post",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: PostIdParam },
  responses: {
    200: { description: "Liked", content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
    409: { description: "Already liked", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const likePostHandler: RouteHandler<typeof likePostRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { postId } = c.req.valid("param");
  const db = await getDb(process.env.MONGODB_URI!);

  const existing = await db.collection(COLLECTIONS.LIKES).findOne({ postId, userId: user.user_id });
  if (existing) throw new HTTPException(409, { message: "Already liked" });

  await db.collection(COLLECTIONS.LIKES).insertOne({
    postId, userId: user.user_id, createdAt: new Date(),
  });
  await db.collection(COLLECTIONS.POSTS).updateOne({ postId }, { $inc: { likeCount: 1 } });

  return c.json({ message: "Post liked" }, 200);
};

app.openapi(likePostRoute, likePostHandler);

// ── DELETE /api/posts/:postId/like ────────────────────────────────────────────

const unlikePostRoute = createRoute({
  method: "delete",
  path: "/api/posts/{postId}/like",
  tags: ["Likes"],
  summary: "Unlike a post",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: PostIdParam },
  responses: {
    200: { description: "Unliked", content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const unlikePostHandler: RouteHandler<typeof unlikePostRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { postId } = c.req.valid("param");
  const db = await getDb(process.env.MONGODB_URI!);

  const result = await db.collection(COLLECTIONS.LIKES).deleteOne({ postId, userId: user.user_id });
  if (result.deletedCount > 0) {
    await db.collection(COLLECTIONS.POSTS).updateOne({ postId }, { $inc: { likeCount: -1 } });
  }

  return c.json({ message: "Post unliked" }, 200);
};

app.openapi(unlikePostRoute, unlikePostHandler);

// ── GET /api/posts/:postId/like ───────────────────────────────────────────────

const getLikeStatusRoute = createRoute({
  method: "get",
  path: "/api/posts/{postId}/like",
  tags: ["Likes"],
  summary: "Like status",
  description: "Returns like count and whether the requesting user has liked the post.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: PostIdParam },
  responses: {
    200: { description: "Like status", content: { "application/json": { schema: LikeStatusSchema } } },
  },
});

const getLikeStatusHandler: RouteHandler<typeof getLikeStatusRoute, AppEnv> = async (c) => {
  const user = await tryGetAuthUser(c);
  const { postId } = c.req.valid("param");
  const db = await getDb(process.env.MONGODB_URI!);

  const [count, likedDoc] = await Promise.all([
    db.collection(COLLECTIONS.LIKES).countDocuments({ postId }),
    user
      ? db.collection(COLLECTIONS.LIKES).findOne({ postId, userId: user.user_id })
      : Promise.resolve(null),
  ]);

  return c.json({ liked: likedDoc !== null, count }, 200);
};

app.openapi(getLikeStatusRoute, getLikeStatusHandler);

export default app;
