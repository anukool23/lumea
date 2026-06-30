import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../types/env.d";
import { getAuthUser } from "../middleware/auth";
import { getDb, COLLECTIONS } from "../lib/mongodb";
import {
  PostIdParam,
  PaginationQuery,
  BookmarkListSchema,
  MessageSchema,
  ErrorSchema,
} from "../models/interaction";

const app = new OpenAPIHono<AppEnv>();

// ── POST /api/posts/:postId/bookmark ──────────────────────────────────────────

const bookmarkPostRoute = createRoute({
  method: "post",
  path: "/api/posts/{postId}/bookmark",
  tags: ["Bookmarks"],
  summary: "Bookmark a post",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: PostIdParam },
  responses: {
    200: { description: "Bookmarked", content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const bookmarkPostHandler: RouteHandler<typeof bookmarkPostRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { postId } = c.req.valid("param");
  const db = await getDb(process.env.MONGODB_URI!);

  await db.collection(COLLECTIONS.BOOKMARKS).updateOne(
    { postId, userId: user.user_id },
    { $setOnInsert: { postId, userId: user.user_id, createdAt: new Date() } },
    { upsert: true }
  );

  return c.json({ message: "Post bookmarked" }, 200);
};

app.openapi(bookmarkPostRoute, bookmarkPostHandler);

// ── DELETE /api/posts/:postId/bookmark ────────────────────────────────────────

const removeBookmarkRoute = createRoute({
  method: "delete",
  path: "/api/posts/{postId}/bookmark",
  tags: ["Bookmarks"],
  summary: "Remove bookmark",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: PostIdParam },
  responses: {
    200: { description: "Removed", content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const removeBookmarkHandler: RouteHandler<typeof removeBookmarkRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { postId } = c.req.valid("param");
  const db = await getDb(process.env.MONGODB_URI!);

  await db.collection(COLLECTIONS.BOOKMARKS).deleteOne({ postId, userId: user.user_id });

  return c.json({ message: "Bookmark removed" }, 200);
};

app.openapi(removeBookmarkRoute, removeBookmarkHandler);

// ── GET /api/users/bookmarks ──────────────────────────────────────────────────

const getBookmarksRoute = createRoute({
  method: "get",
  path: "/api/users/bookmarks",
  tags: ["Bookmarks"],
  summary: "My bookmarks",
  description: "Returns the authenticated user's bookmarked posts, newest first.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { query: PaginationQuery },
  responses: {
    200: { description: "Bookmark list", content: { "application/json": { schema: BookmarkListSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const getBookmarksHandler: RouteHandler<typeof getBookmarksRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { page, limit } = c.req.valid("query");
  const db = await getDb(process.env.MONGODB_URI!);

  const skip = (page - 1) * limit;

  const [rawData, total] = await Promise.all([
    db.collection(COLLECTIONS.BOOKMARKS)
      .find({ userId: user.user_id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.BOOKMARKS).countDocuments({ userId: user.user_id }),
  ]);

  const data = rawData.map((d) => ({
    postId:    d.postId as string,
    createdAt: (d.createdAt as Date).toISOString(),
  }));

  return c.json({ data, total, page, limit }, 200);
};

app.openapi(getBookmarksRoute, getBookmarksHandler);

export default app;
