import { z } from "@hono/zod-openapi";

// ── Shared param schemas ───────────────────────────────────────────────────────

export const PostIdParam = z.object({
  postId: z.string().uuid().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
});

export const CommentIdParam = z.object({
  commentId: z.string().openapi({ example: "64e4f1a2b3c4d5e6f7a8b9c0" }),
});

export const PaginationQuery = z.object({
  page:  z.string().pipe(z.coerce.number().int().min(1)).default("1").openapi({ example: "1" }),
  limit: z.string().pipe(z.coerce.number().int().min(1).max(50)).default("20").openapi({ example: "20" }),
});

// ── Response schemas ───────────────────────────────────────────────────────────

export const ErrorSchema = z.object({ error: z.string() }).openapi("Error");
export const MessageSchema = z.object({ message: z.string() }).openapi("Message");

// ── Like schemas ───────────────────────────────────────────────────────────────

export const LikeStatusSchema = z
  .object({
    liked: z.boolean().openapi({ example: true }),
    count: z.number().int().openapi({ example: 42 }),
  })
  .openapi("LikeStatus");

// ── Comment schemas ────────────────────────────────────────────────────────────

export const CreateCommentSchema = z
  .object({
    content:  z.string().min(1).max(2000).openapi({ example: "Great article!" }),
    parentId: z.string().optional().openapi({ description: "Parent comment _id for replies" }),
  })
  .openapi("CreateComment");

export const UpdateCommentSchema = z
  .object({ content: z.string().min(1).max(2000).openapi({ example: "Updated content" }) })
  .openapi("UpdateComment");

export const CommentSchema = z
  .object({
    _id:           z.string().openapi({ example: "64e4f1a2b3c4d5e6f7a8b9c0" }),
    postId:        z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    authorId:      z.string(),
    authorUsername:z.string(),
    authorName:    z.string(),
    authorPicture: z.string().optional(),
    content:       z.string(),
    parentId:      z.string().optional(),
    likeCount:     z.number().int(),
    isEdited:      z.boolean(),
    createdAt:     z.string().datetime(),
    updatedAt:     z.string().datetime().optional(),
  })
  .openapi("Comment");

export const CommentListSchema = z
  .object({
    data:  z.array(CommentSchema),
    total: z.number().int(),
    page:  z.number().int(),
    limit: z.number().int(),
  })
  .openapi("CommentList");

// ── Bookmark schemas ───────────────────────────────────────────────────────────

export const BookmarkItemSchema = z
  .object({
    postId:    z.string(),
    createdAt: z.string().datetime(),
  })
  .openapi("BookmarkItem");

export const BookmarkListSchema = z
  .object({
    data:  z.array(BookmarkItemSchema),
    total: z.number().int(),
    page:  z.number().int(),
    limit: z.number().int(),
  })
  .openapi("BookmarkList");
