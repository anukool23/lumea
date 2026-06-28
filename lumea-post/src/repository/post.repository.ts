import { Db, ObjectId, Filter, Sort } from "mongodb";
import { COLLECTIONS, PostDocument, PostStatus } from "../models/post";

export interface PostFilter {
  authorId?: string;
  status?: PostStatus | PostStatus[];
  isPremium?: boolean;
  tags?: string[];
  category?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: Sort;
}

export class PostRepository {
  constructor(private db: Db) {}

  private get collection() {
    return this.db.collection<PostDocument>(COLLECTIONS.POSTS);
  }

  async create(doc: PostDocument): Promise<PostDocument> {
    const result = await this.collection.insertOne(doc);
    return { ...doc, _id: result.insertedId };
  }

  async findByPostId(postId: string): Promise<PostDocument | null> {
    return this.collection.findOne({ postId });
  }

  async findBySlugAndAuthor(slug: string, authorId: string): Promise<PostDocument | null> {
    return this.collection.findOne({ slug, authorId });
  }

  async findMany(
    filter: PostFilter,
    pagination: PaginationOptions
  ): Promise<{ data: PostDocument[]; total: number }> {
    const query = this.buildQuery(filter);
    const sort: Sort = pagination.sort ?? { createdAt: -1 };
    const skip = (pagination.page - 1) * pagination.limit;

    const [data, total] = await Promise.all([
      this.collection
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(pagination.limit)
        .toArray(),
      this.collection.countDocuments(query),
    ]);

    return { data, total };
  }

  async updateByPostId(
    postId: string,
    authorId: string,
    update: Partial<PostDocument>
  ): Promise<PostDocument | null> {
    update.updatedAt = new Date();

    const result = await this.collection.findOneAndUpdate(
      { postId, authorId },
      { $set: update },
      { returnDocument: "after" }
    );

    return result ?? null;
  }

  async deleteByPostId(postId: string, authorId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ postId, authorId });
    return result.deletedCount === 1;
  }

  async publish(postId: string, authorId: string): Promise<PostDocument | null> {
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { postId, authorId, status: { $in: [PostStatus.DRAFT, PostStatus.SCHEDULED] } },
      {
        $set: {
          status: PostStatus.PUBLISHED,
          publishedAt: now,
          updatedAt: now,
        },
      },
      { returnDocument: "after" }
    );
    return result ?? null;
  }

  async unpublish(postId: string, authorId: string): Promise<PostDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      { postId, authorId, status: PostStatus.PUBLISHED },
      {
        $set: {
          status: PostStatus.DRAFT,
          updatedAt: new Date(),
        },
        $unset: { publishedAt: "" },
      },
      { returnDocument: "after" }
    );
    return result ?? null;
  }

  async archive(postId: string, authorId: string): Promise<PostDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      { postId, authorId },
      { $set: { status: PostStatus.ARCHIVED, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    return result ?? null;
  }

  /** Increment a counter field (likeCount, viewCount, commentCount) */
  async incrementCounter(
    postId: string,
    field: "likeCount" | "viewCount" | "commentCount",
    delta: number = 1
  ): Promise<void> {
    await this.collection.updateOne(
      { postId },
      { $inc: { [field]: delta }, $set: { updatedAt: new Date() } }
    );
  }

  async ensureIndexes(): Promise<void> {
    await this.collection.createIndexes([
      { key: { postId: 1 }, unique: true },
      { key: { authorId: 1, status: 1 } },
      { key: { authorId: 1, slug: 1 }, unique: true },
      { key: { status: 1, publishedAt: -1 } },
      { key: { tags: 1 } },
      { key: { category: 1 } },
      { key: { scheduledAt: 1 }, sparse: true },
    ]);
  }

  private buildQuery(filter: PostFilter): Filter<PostDocument> {
    const query: Filter<PostDocument> = {};

    if (filter.authorId) query.authorId = filter.authorId;
    if (filter.isPremium !== undefined) query.isPremium = filter.isPremium;
    if (filter.category) query.category = filter.category;

    if (filter.status) {
      query.status = Array.isArray(filter.status)
        ? { $in: filter.status }
        : filter.status;
    }

    if (filter.tags && filter.tags.length > 0) {
      query.tags = { $in: filter.tags };
    }

    return query;
  }
}
