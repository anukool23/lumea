import type { PostDoc } from "../repository/post.repository";
import type { JWTPayload } from "../types/env.d";
import type { PublicPost } from "../models/content";
import { isActiveSupporterPlan } from "../types/env.d";

const PREMIUM_PREVIEW_CHARS = 500;

/**
 * Maps a raw PostDoc to a PublicPost, applying the premium gate.
 *
 * Gate logic:
 *  - Free post → full content always
 *  - Premium post + active supporter JWT → full content
 *  - Premium post + no/non-supporter JWT → content truncated, isGated=true
 */
export function toPublicPost(doc: PostDoc, viewer?: JWTPayload): PublicPost {
  const isGated = doc.isPremium && !canViewPremium(viewer);

  return {
    postId: doc.postId,
    authorId: doc.authorId,
    authorUsername: doc.authorUsername,
    authorName: doc.authorName,
    authorPicture: doc.authorPicture,
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    content: isGated
      ? stripToPreview(doc.content, PREMIUM_PREVIEW_CHARS)
      : doc.content,
    isGated,
    coverImage: doc.coverImage,
    tags: doc.tags,
    category: doc.category,
    isPremium: doc.isPremium,
    readingTimeMin: doc.readingTimeMin,
    wordCount: doc.wordCount,
    likeCount: doc.likeCount,
    viewCount: doc.viewCount,
    commentCount: doc.commentCount,
    publishedAt: doc.publishedAt!.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

function canViewPremium(user?: JWTPayload): boolean {
  if (!user) return false;
  return isActiveSupporterPlan(user.plan) || user.role === "ADMIN" || user.role === "EDITOR";
}

/**
 * Strips HTML to text and truncates to maxChars, preserving word boundaries.
 */
function stripToPreview(html: string, maxChars: number): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxChars) return text;
  return text.substring(0, maxChars).replace(/\w+$/, "") + "...";
}
