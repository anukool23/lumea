import { z } from "@hono/zod-openapi";

// ── Public post response ───────────────────────────────────────────────────────

export const PublicPostSchema = z
  .object({
    postId: z.string(),
    authorId: z.string(),
    authorUsername: z.string(),
    authorName: z.string(),
    authorPicture: z.string().optional(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string(),
    /** Full HTML — null when post is premium-gated */
    content: z.string().nullable(),
    isGated: z.boolean().openapi({ description: "True when content is premium and user is not a supporter" }),
    coverImage: z.string().optional(),
    tags: z.array(z.string()),
    category: z.string().optional(),
    isPremium: z.boolean(),
    readingTimeMin: z.number().int(),
    wordCount: z.number().int(),
    likeCount: z.number().int(),
    viewCount: z.number().int(),
    commentCount: z.number().int(),
    publishedAt: z.string().datetime(),
    createdAt: z.string().datetime(),
  })
  .openapi("PublicPost");

export const FeedResponseSchema = z
  .object({
    data: z.array(PublicPostSchema),
    total: z.number().int(),
    page: z.number().int(),
    hasMore: z.boolean(),
    feedType: z.enum(["following", "trending", "explore"]),
  })
  .openapi("FeedResponse");

export const SearchResultSchema = z
  .object({
    data: z.array(PublicPostSchema),
    total: z.number().int(),
    query: z.string(),
    took: z.number().int().openapi({ description: "OpenSearch query time in ms" }),
  })
  .openapi("SearchResult");

export const ErrorResponseSchema = z
  .object({ error: z.string() })
  .openapi("ErrorResponse");

// ── Query param schemas ────────────────────────────────────────────────────────

export const FeedQuerySchema = z.object({
  page: z.string().pipe(z.coerce.number().int().min(1)).default("1"),
  limit: z.string().pipe(z.coerce.number().int().min(1).max(30)).default("20"),
  type: z.enum(["following", "trending", "explore"]).default("trending"),
  category: z.string().optional(),
  tag: z.string().optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200).openapi({ example: "typescript microservices" }),
  page: z.string().pipe(z.coerce.number().int().min(1)).default("1"),
  limit: z.string().pipe(z.coerce.number().int().min(1).max(30)).default("20"),
  tags: z.string().optional().openapi({ description: "Comma-separated tag filter" }),
  category: z.string().optional(),
  premium: z.enum(["all", "free", "premium"]).default("all"),
});

export type PublicPost = z.infer<typeof PublicPostSchema>;
