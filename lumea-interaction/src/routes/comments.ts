import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { ObjectId } from "mongodb";
import type { AppEnv } from "../types/env.d";
import { getAuthUser } from "../middleware/auth";
import { getDb, COLLECTIONS } from "../lib/mongodb";
import {
  PostIdParam,
  CommentIdParam,
  PaginationQuery,
  CreateCommentSchema,
  UpdateCommentSchema,
  CommentSchema,
  CommentListSchema,
  MessageSchema,
  ErrorSchema,
} from "../models/interaction";

const app = new OpenAPIHono<AppEnv>();

// ── POST /api/posts/:postId/comments ──────────────────────────────────────────

const createCommentRoute = createRoute({
  method: "post",
  path: "/api/posts/{postId}/comments",
  tags: ["Comments"],
  summary: "Add a comment",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    params: PostIdParam,
    body: { content: { "application/json": { schema: CreateCommentSchema } }, required: true },
  },
  responses: {
    201: { description: "Comment created", content: { "application/json": { schema: CommentSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const createCommentHandler: RouteHandler<typeof createCommentRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { postId } = c.req.valid("param");
  const { content, parentId } = c.req.valid("json");
  const db = await getDb(process.env.MONGODB_URI!);

  const now = new Date();
  const doc = {
    postId,
    authorId:       user.user_id,
    authorUsername: user.username,
    authorName:     user.username,
    content,
    parentId,
    likeCount:      0,
    isEdited:       false,
    createdAt:      now,
  };

  const result = await db.collection(COLLECTIONS.COMMENTS).insertOne(doc);
  await db.collection(COLLECTIONS.POSTS).updateOne({ postId }, { $inc: { commentCount: 1 } });

  return c.json(
    {
      ...doc,
      _id:       result.insertedId.toString(),
      createdAt: now.toISOString(),
    },
    201
  );
};

app.openapi(createCommentRoute, createCommentHandler);

// ── GET /api/posts/:postId/comments ───────────────────────────────────────────

const getCommentsRoute = createRoute({
  method: "get",
  path: "/api/posts/{postId}/comments",
  tags: ["Comments"],
  summary: "Get comments for a post",
  description: "Returns top-level comments (no parentId). Paginated, newest first.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: PostIdParam, query: PaginationQuery },
  responses: {
    200: { description: "Comment list", content: { "application/json": { schema: CommentListSchema } } },
  },
});

const getCommentsHandler: RouteHandler<typeof getCommentsRoute, AppEnv> = async (c) => {
  const { postId } = c.req.valid("param");
  const { page, limit } = c.req.valid("query");
  const db = await getDb(process.env.MONGODB_URI!);

  const skip = (page - 1) * limit;
  const filter = { postId, parentId: { $exists: false } };

  const [rawData, total] = await Promise.all([
    db.collection(COLLECTIONS.COMMENTS)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.COMMENTS).countDocuments(filter),
  ]);

  const data = rawData.map((d) => ({
    _id:            d._id.toString(),
    postId:         d.postId as string,
    authorId:       d.authorId as string,
    authorUsername: d.authorUsername as string,
    authorName:     d.authorName as string,
    authorPicture:  d.authorPicture as string | undefined,
    content:        d.content as string,
    parentId:       d.parentId as string | undefined,
    likeCount:      d.likeCount as number,
    isEdited:       d.isEdited as boolean,
    createdAt:      (d.createdAt as Date).toISOString(),
    updatedAt:      d.updatedAt ? (d.updatedAt as Date).toISOString() : undefined,
  }));

  return c.json({ data, total, page, limit }, 200);
};

app.openapi(getCommentsRoute, getCommentsHandler);

// ── PATCH /api/comments/:commentId ────────────────────────────────────────────

const updateCommentRoute = createRoute({
  method: "patch",
  path: "/api/comments/{commentId}",
  tags: ["Comments"],
  summary: "Edit a comment",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    params: CommentIdParam,
    body: { content: { "application/json": { schema: UpdateCommentSchema } }, required: true },
  },
  responses: {
    200: { description: "Updated comment", content: { "application/json": { schema: CommentSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const updateCommentHandler: RouteHandler<typeof updateCommentRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { commentId } = c.req.valid("param");
  const { content } = c.req.valid("json");
  const db = await getDb(process.env.MONGODB_URI!);

  let oid: ObjectId;
  try { oid = new ObjectId(commentId); } catch {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  const existing = await db.collection(COLLECTIONS.COMMENTS).findOne({ _id: oid });
  if (!existing) throw new HTTPException(404, { message: "Comment not found" });
  if (existing.authorId !== user.user_id) throw new HTTPException(403, { message: "Forbidden" });

  const now = new Date();
  const updated = await db.collection(COLLECTIONS.COMMENTS).findOneAndUpdate(
    { _id: oid },
    { $set: { content, isEdited: true, updatedAt: now } },
    { returnDocument: "after" }
  );

  if (!updated) throw new HTTPException(404, { message: "Comment not found" });

  return c.json(
    {
      _id:            updated._id.toString(),
      postId:         updated.postId as string,
      authorId:       updated.authorId as string,
      authorUsername: updated.authorUsername as string,
      authorName:     updated.authorName as string,
      authorPicture:  updated.authorPicture as string | undefined,
      content:        updated.content as string,
      parentId:       updated.parentId as string | undefined,
      likeCount:      updated.likeCount as number,
      isEdited:       updated.isEdited as boolean,
      createdAt:      (updated.createdAt as Date).toISOString(),
      updatedAt:      now.toISOString(),
    },
    200
  );
};

app.openapi(updateCommentRoute, updateCommentHandler);

// ── DELETE /api/comments/:commentId ───────────────────────────────────────────

const deleteCommentRoute = createRoute({
  method: "delete",
  path: "/api/comments/{commentId}",
  tags: ["Comments"],
  summary: "Delete a comment",
  description: "Author or ADMIN can delete.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: CommentIdParam },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  },
});

const deleteCommentHandler: RouteHandler<typeof deleteCommentRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { commentId } = c.req.valid("param");
  const db = await getDb(process.env.MONGODB_URI!);

  let oid: ObjectId;
  try { oid = new ObjectId(commentId); } catch {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  const comment = await db.collection(COLLECTIONS.COMMENTS).findOne({ _id: oid });
  if (!comment) throw new HTTPException(404, { message: "Comment not found" });
  if (comment.authorId !== user.user_id && user.role !== "ADMIN") {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  await db.collection(COLLECTIONS.COMMENTS).deleteOne({ _id: oid });
  await db.collection(COLLECTIONS.POSTS).updateOne(
    { postId: comment.postId as string },
    { $inc: { commentCount: -1 } }
  );

  return c.json({ message: "Comment deleted" }, 200);
};

app.openapi(deleteCommentRoute, deleteCommentHandler);

export default app;
