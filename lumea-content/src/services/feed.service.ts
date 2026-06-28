import { ContentPostRepository } from "../repository/post.repository";
import { Redis } from "@upstash/redis";
import { CacheKeys, TTL } from "../lib/redis";
import { toPublicPost } from "./content.service";
import type { JWTPayload } from "../types/env.d";
import type { PublicPost } from "../models/content";

export class FeedService {
  constructor(
    private repo: ContentPostRepository,
    private redis: Redis,
    private authServiceUrl: string,
    private internalToken: string
  ) {}

  async getTrending(
    page: number,
    limit: number,
    viewer?: JWTPayload
  ): Promise<{ data: PublicPost[]; total: number }> {
    const cacheKey = CacheKeys.trending();

    // Cache only page 1 of trending
    if (page === 1) {
      const cached = await this.redis.get<PublicPost[]>(cacheKey);
      if (cached) return { data: cached.slice(0, limit), total: cached.length };
    }

    const { data, total } = await this.repo.findTrending(page, limit);
    const posts = data.map((d) => toPublicPost(d, viewer));

    if (page === 1) {
      await this.redis.set(cacheKey, posts, { ex: TTL.TRENDING });
    }

    return { data: posts, total };
  }

  async getFollowingFeed(
    userId: string,
    page: number,
    limit: number,
    viewer: JWTPayload
  ): Promise<{ data: PublicPost[]; total: number }> {
    // Get following IDs from Redis cache or Auth Service
    const followingIds = await this.getFollowingIds(userId);

    if (followingIds.length === 0) {
      // No following → fall back to trending
      return this.getTrending(page, limit, viewer);
    }

    const { data, total } = await this.repo.findFeed({
      authorIds: followingIds,
      page,
      limit,
      sort: { publishedAt: -1 },
    });

    return { data: data.map((d) => toPublicPost(d, viewer)), total };
  }

  async getExplore(
    page: number,
    limit: number,
    viewer?: JWTPayload,
    category?: string,
    tag?: string
  ): Promise<{ data: PublicPost[]; total: number }> {
    const tags = tag ? [tag] : undefined;
    const { data, total } = await this.repo.findFeed({
      page,
      limit,
      category,
      tags,
      sort: { publishedAt: -1 },
    });

    return { data: data.map((d) => toPublicPost(d, viewer)), total };
  }

  async getRelated(postId: string, tags: string[], viewer?: JWTPayload): Promise<PublicPost[]> {
    const posts = await this.repo.findRelated(postId, tags, 5);
    return posts.map((d) => toPublicPost(d, viewer));
  }

  async getPopularTags(): Promise<{ tag: string; count: number }[]> {
    return this.repo.findPopularTags(30);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private async getFollowingIds(userId: string): Promise<string[]> {
    const cacheKey = CacheKeys.following(userId);

    // Try Redis cache first
    const cached = await this.redis.get<string[]>(cacheKey);
    if (cached) return cached;

    // Fetch from Auth Service
    try {
      const res = await fetch(
        `${this.authServiceUrl}/api/users/${userId}/following?limit=500`,
        {
          headers: { "X-Internal-Token": this.internalToken },
        }
      );

      if (!res.ok) return [];

      const json = await res.json() as { data: { id: string }[] };
      const ids = (json.data ?? []).map((u) => u.id);

      // Cache for 5 min
      if (ids.length > 0) {
        await this.redis.set(cacheKey, ids, { ex: TTL.FOLLOWING });
      }

      return ids;
    } catch {
      return [];
    }
  }
}
