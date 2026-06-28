import { PostRepository } from "../repository/post.repository";
import {
  PostDocument,
  PostStatus,
  CreatePostInput,
  UpdatePostInput,
  toPostResponse,
  PostResponseSchema,
} from "../models/post";
import {
  generateSlug,
  uniqueSlug,
  stripHtml,
  calcReadingTime,
  countWords,
  extractExcerpt,
  newUUID,
} from "../lib/utils";
import { z } from "@hono/zod-openapi";

type PostResponse = z.infer<typeof PostResponseSchema>;

export class PostService {
  constructor(private repo: PostRepository) {}

  async createPost(
    input: CreatePostInput,
    authorId: string,
    authorUsername: string,
    authorName: string,
    authorPicture?: string
  ): Promise<PostResponse> {
    const contentText = stripHtml(input.content);
    const wordCount = countWords(contentText);
    const readingTimeMin = calcReadingTime(wordCount);
    const excerpt = input.excerpt ?? extractExcerpt(input.content);

    // Generate a unique slug for this author
    let slug = generateSlug(input.title);
    const existing = await this.repo.findBySlugAndAuthor(slug, authorId);
    if (existing) {
      slug = uniqueSlug(slug);
    }

    // Validate scheduled post
    if (input.status === "SCHEDULED" && !input.scheduledAt) {
      throw new Error("scheduledAt is required when status is SCHEDULED");
    }

    const now = new Date();
    const doc: PostDocument = {
      postId: newUUID(),
      authorId,
      authorUsername,
      authorName,
      authorPicture,
      title: input.title,
      slug,
      excerpt,
      content: input.content,
      contentText,
      coverImage: input.coverImage,
      tags: input.tags ?? [],
      category: input.category,
      status: input.status as PostStatus ?? PostStatus.DRAFT,
      isPremium: input.isPremium ?? false,
      readingTimeMin,
      wordCount,
      likeCount: 0,
      viewCount: 0,
      commentCount: 0,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.repo.create(doc);
    return toPostResponse(created);
  }

  async getPost(postId: string, requesterId: string): Promise<PostResponse> {
    const doc = await this.repo.findByPostId(postId);
    if (!doc) throw new NotFoundError("Post not found");

    // Drafts/archived are only visible to the author
    if (doc.status !== PostStatus.PUBLISHED && doc.authorId !== requesterId) {
      throw new NotFoundError("Post not found");
    }

    return toPostResponse(doc);
  }

  async getMyPosts(
    authorId: string,
    page: number,
    limit: number,
    status?: string
  ): Promise<{ data: PostResponse[]; total: number; page: number; limit: number; hasMore: boolean }> {
    const statusFilter = status
      ? ([status] as PostStatus[])
      : [PostStatus.DRAFT, PostStatus.PUBLISHED, PostStatus.SCHEDULED, PostStatus.ARCHIVED];

    const { data, total } = await this.repo.findMany(
      { authorId, status: statusFilter },
      { page, limit, sort: { updatedAt: -1 } }
    );

    return {
      data: data.map(toPostResponse),
      total,
      page,
      limit,
      hasMore: page * limit < total,
    };
  }

  async updatePost(
    postId: string,
    authorId: string,
    input: UpdatePostInput
  ): Promise<PostResponse> {
    const existing = await this.repo.findByPostId(postId);
    if (!existing) throw new NotFoundError("Post not found");
    if (existing.authorId !== authorId) throw new ForbiddenError("Not your post");
    if (existing.status === PostStatus.ARCHIVED) {
      throw new BadRequestError("Cannot edit an archived post");
    }

    const update: Partial<PostDocument> = {};

    if (input.title !== undefined) {
      update.title = input.title;
      // Re-generate slug only if title changed
      if (input.title !== existing.title) {
        let newSlug = generateSlug(input.title);
        const slugConflict = await this.repo.findBySlugAndAuthor(newSlug, authorId);
        if (slugConflict && slugConflict.postId !== postId) {
          newSlug = uniqueSlug(newSlug);
        }
        update.slug = newSlug;
      }
    }

    if (input.content !== undefined) {
      update.content = input.content;
      update.contentText = stripHtml(input.content);
      update.wordCount = countWords(update.contentText);
      update.readingTimeMin = calcReadingTime(update.wordCount);
      // Auto-refresh excerpt unless manually set
      if (input.excerpt === undefined) {
        update.excerpt = extractExcerpt(input.content);
      }
    }

    if (input.excerpt !== undefined) update.excerpt = input.excerpt;
    if (input.coverImage !== undefined) update.coverImage = input.coverImage ?? undefined;
    if (input.tags !== undefined) update.tags = input.tags;
    if (input.category !== undefined) update.category = input.category ?? undefined;
    if (input.isPremium !== undefined) update.isPremium = input.isPremium;
    if (input.scheduledAt !== undefined) {
      update.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : undefined;
    }

    const updated = await this.repo.updateByPostId(postId, authorId, update);
    if (!updated) throw new NotFoundError("Post not found");

    return toPostResponse(updated);
  }

  async deletePost(postId: string, authorId: string): Promise<void> {
    const existing = await this.repo.findByPostId(postId);
    if (!existing) throw new NotFoundError("Post not found");
    if (existing.authorId !== authorId) throw new ForbiddenError("Not your post");

    const deleted = await this.repo.deleteByPostId(postId, authorId);
    if (!deleted) throw new NotFoundError("Post not found");
  }

  async publishPost(postId: string, authorId: string, scheduledAt?: string): Promise<PostResponse> {
    const existing = await this.repo.findByPostId(postId);
    if (!existing) throw new NotFoundError("Post not found");
    if (existing.authorId !== authorId) throw new ForbiddenError("Not your post");

    if (existing.status === PostStatus.PUBLISHED) {
      throw new BadRequestError("Post is already published");
    }
    if (existing.status === PostStatus.ARCHIVED) {
      throw new BadRequestError("Cannot publish an archived post. Unarchive it first.");
    }

    // Schedule instead of immediate publish
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        throw new BadRequestError("scheduledAt must be in the future");
      }
      const updated = await this.repo.updateByPostId(postId, authorId, {
        status: PostStatus.SCHEDULED,
        scheduledAt: scheduledDate,
      });
      if (!updated) throw new NotFoundError("Post not found");
      return toPostResponse(updated);
    }

    const published = await this.repo.publish(postId, authorId);
    if (!published) throw new NotFoundError("Post not found");

    return toPostResponse(published);
  }

  async unpublishPost(postId: string, authorId: string): Promise<PostResponse> {
    const existing = await this.repo.findByPostId(postId);
    if (!existing) throw new NotFoundError("Post not found");
    if (existing.authorId !== authorId) throw new ForbiddenError("Not your post");

    if (existing.status !== PostStatus.PUBLISHED) {
      throw new BadRequestError("Post is not currently published");
    }

    const updated = await this.repo.unpublish(postId, authorId);
    if (!updated) throw new NotFoundError("Post not found");

    return toPostResponse(updated);
  }

  async togglePremium(postId: string, authorId: string, isPremium: boolean): Promise<PostResponse> {
    const existing = await this.repo.findByPostId(postId);
    if (!existing) throw new NotFoundError("Post not found");
    if (existing.authorId !== authorId) throw new ForbiddenError("Not your post");

    const updated = await this.repo.updateByPostId(postId, authorId, { isPremium });
    if (!updated) throw new NotFoundError("Post not found");

    return toPostResponse(updated);
  }

  async updateCover(postId: string, authorId: string, coverImage: string): Promise<PostResponse> {
    const existing = await this.repo.findByPostId(postId);
    if (!existing) throw new NotFoundError("Post not found");
    if (existing.authorId !== authorId) throw new ForbiddenError("Not your post");

    const updated = await this.repo.updateByPostId(postId, authorId, { coverImage });
    if (!updated) throw new NotFoundError("Post not found");

    return toPostResponse(updated);
  }

  async archivePost(postId: string, authorId: string): Promise<PostResponse> {
    const existing = await this.repo.findByPostId(postId);
    if (!existing) throw new NotFoundError("Post not found");
    if (existing.authorId !== authorId) throw new ForbiddenError("Not your post");

    const updated = await this.repo.archive(postId, authorId);
    if (!updated) throw new NotFoundError("Post not found");

    return toPostResponse(updated);
  }

  async getStats(authorId: string): Promise<WriterStats> {
    const { data: all } = await this.repo.findMany(
      { authorId },
      { page: 1, limit: 1000, sort: { createdAt: -1 } }
    );

    const published = all.filter((p) => p.status === PostStatus.PUBLISHED);
    const drafts = all.filter((p) => p.status === PostStatus.DRAFT);

    return {
      totalPosts: all.length,
      publishedPosts: published.length,
      draftPosts: drafts.length,
      totalViews: published.reduce((s, p) => s + p.viewCount, 0),
      totalLikes: published.reduce((s, p) => s + p.likeCount, 0),
      totalComments: published.reduce((s, p) => s + p.commentCount, 0),
    };
  }
}

// ── Domain errors ─────────────────────────────────────────────────────────────

export class NotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ForbiddenError";
  }
}

export class BadRequestError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BadRequestError";
  }
}

export interface WriterStats {
  totalPosts: number;
  publishedPosts: number;
  draftPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
}
