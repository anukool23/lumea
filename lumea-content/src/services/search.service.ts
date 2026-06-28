import { SearchRepository } from "../repository/search.repository";
import { toPublicPost } from "./content.service";
import type { JWTPayload } from "../types/env.d";
import type { PublicPost } from "../models/content";

export class SearchService {
  constructor(private repo: SearchRepository) {}

  async search(
    query: string,
    page: number,
    limit: number,
    viewer?: JWTPayload,
    opts?: { tags?: string; category?: string; premium?: "all" | "free" | "premium" }
  ): Promise<{ data: PublicPost[]; total: number; took: number }> {
    const tags = opts?.tags?.split(",").map((t) => t.trim()).filter(Boolean);

    const result = await this.repo.search({
      query,
      page,
      limit,
      tags,
      category: opts?.category,
      premium: opts?.premium ?? "all",
    });

    // Map OS hits to PublicPost format
    // OS hits don't have full content — we just return excerpt for search results
    const data: PublicPost[] = result.hits.map((hit) => ({
      postId: hit.post_id,
      authorId: hit.author_id,
      authorUsername: hit.author_id, // OS doesn't store username — enriched later
      authorName: hit.author_name,
      title: hit.title,
      slug: hit.post_id,             // slug enriched from MongoDB if needed
      excerpt: hit.excerpt,
      content: null,                 // search results don't include full content
      isGated: hit.is_premium,
      tags: hit.tags,
      category: hit.category,
      isPremium: hit.is_premium,
      readingTimeMin: 0,
      wordCount: 0,
      likeCount: hit.like_count,
      viewCount: hit.view_count,
      commentCount: hit.comment_count,
      publishedAt: hit.published_at,
      createdAt: hit.published_at,
    }));

    return { data, total: result.total, took: result.took };
  }

  async suggest(query: string): Promise<string[]> {
    return this.repo.suggest(query, 5);
  }
}
