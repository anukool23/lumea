import { z } from "@hono/zod-openapi";
import type { ObjectId } from "mongodb";

// ── Status enum ───────────────────────────────────────────────────────────────

export const PostStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
  SCHEDULED: "SCHEDULED",
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

// ── MongoDB document interface ────────────────────────────────────────────────

export interface PostDocument {
  _id?: ObjectId;
  postId: string;           // UUID — public-facing identifier
  authorId: string;         // UUID from auth service
  authorUsername: string;   // denormalized — updated on profile change
  authorName: string;       // denormalized
  authorPicture?: string;   // denormalized
  title: string;
  slug: string;             // url-safe, unique per author
  excerpt: string;          // first 200 chars plain text, or manual override
  content: string;          // HTML from Tiptap
  contentText: string;      // plain text (for OpenSearch indexing)
  coverImage?: string;      // Cloudinary CDN URL
  tags: string[];
  category?: string;
  status: PostStatus;
  isPremium: boolean;
  readingTimeMin: number;   // calculated
  wordCount: number;        // calculated
  likeCount: number;        // updated by Interaction Service
  viewCount: number;        // updated by Analytics Service
  commentCount: number;     // updated by Interaction Service
  scheduledAt?: Date;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Zod schemas (used for OpenAPI + runtime validation) ───────────────────────

export const CreatePostSchema = z
  .object({
    title: z.string().min(3).max(200).openapi({ example: "My First Post" }),
    content: z.string().min(1).openapi({ description: "HTML from Tiptap editor" }),
    excerpt: z.string().max(300).optional().openapi({ example: "A brief summary..." }),
    coverImage: z.string().url().optional().openapi({ example: "https://res.cloudinary.com/..." }),
    tags: z.array(z.string().max(30)).max(10).default([]).openapi({ example: ["tech", "golang"] }),
    category: z.string().max(50).optional().openapi({ example: "Technology" }),
    isPremium: z.boolean().default(false),
    status: z.enum(["DRAFT", "SCHEDULED"]).default("DRAFT"),
    scheduledAt: z.string().datetime().optional().openapi({ description: "ISO 8601, only if status=SCHEDULED" }),
  })
  .openapi("CreatePostRequest");

export const UpdatePostSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    content: z.string().min(1).optional(),
    excerpt: z.string().max(300).optional(),
    coverImage: z.string().url().optional().nullable(),
    tags: z.array(z.string().max(30)).max(10).optional(),
    category: z.string().max(50).optional().nullable(),
    isPremium: z.boolean().optional(),
    scheduledAt: z.string().datetime().optional().nullable(),
  })
  .openapi("UpdatePostRequest");

export const PublishPostSchema = z
  .object({
    scheduledAt: z.string().datetime().optional().openapi({
      description: "If provided, schedules the post instead of publishing immediately",
    }),
  })
  .optional()
  .openapi("PublishPostRequest");

export const TogglePremiumSchema = z
  .object({
    isPremium: z.boolean(),
  })
  .openapi("TogglePremiumRequest");

export const UpdateCoverSchema = z
  .object({
    coverImage: z.string().url().openapi({ example: "https://res.cloudinary.com/..." }),
  })
  .openapi("UpdateCoverRequest");

// ── Response schema ───────────────────────────────────────────────────────────

export const PostResponseSchema = z
  .object({
    postId: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
    authorId: z.string(),
    authorUsername: z.string(),
    authorName: z.string(),
    authorPicture: z.string().optional(),
    title: z.string(),
    slug: z.string().openapi({ example: "my-first-post" }),
    excerpt: z.string(),
    content: z.string(),
    coverImage: z.string().optional(),
    tags: z.array(z.string()),
    category: z.string().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED"]),
    isPremium: z.boolean(),
    readingTimeMin: z.number().int(),
    wordCount: z.number().int(),
    likeCount: z.number().int(),
    viewCount: z.number().int(),
    commentCount: z.number().int(),
    scheduledAt: z.string().datetime().optional(),
    publishedAt: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("PostResponse");

export const PostListResponseSchema = z
  .object({
    data: z.array(PostResponseSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    hasMore: z.boolean(),
  })
  .openapi("PostListResponse");

export const MessageResponseSchema = z
  .object({ message: z.string() })
  .openapi("MessageResponse");

export const ErrorResponseSchema = z
  .object({ error: z.string() })
  .openapi("ErrorResponse");

// ── Type helpers ──────────────────────────────────────────────────────────────

export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;

export function toPostResponse(doc: PostDocument): z.infer<typeof PostResponseSchema> {
  return {
    postId: doc.postId,
    authorId: doc.authorId,
    authorUsername: doc.authorUsername,
    authorName: doc.authorName,
    authorPicture: doc.authorPicture,
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    content: doc.content,
    coverImage: doc.coverImage,
    tags: doc.tags,
    category: doc.category,
    status: doc.status,
    isPremium: doc.isPremium,
    readingTimeMin: doc.readingTimeMin,
    wordCount: doc.wordCount,
    likeCount: doc.likeCount,
    viewCount: doc.viewCount,
    commentCount: doc.commentCount,
    scheduledAt: doc.scheduledAt?.toISOString(),
    publishedAt: doc.publishedAt?.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
