import { Db, Filter, Sort } from "mongodb";
import { COLLECTIONS } from "../lib/mongodb";

export interface PostDoc {
  postId: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  authorPicture?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentText: string;
  coverImage?: string;
  tags: string[];
  category?: string;
  status: string;
  isPremium: boolean;
  readingTimeMin: number;
  wordCount: number;
  likeCount: number;
  viewCount: number;
  commentCount: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeedOptions {
  authorIds?: string[];
  tags?: string[];
  category?: string;
  page: number;
  limit: number;
  sort?: Sort;
}

export class ContentPostRepository {
  constructor(private db: Db) {}

  private get col() {
    return this.db.collection<PostDoc>(COLLECTIONS.POSTS);
  }

  async findPublishedById(postId: string): Promise<PostDoc | null> {
    return this.col.findOne({ postId, status: "PUBLISHED" });
  }

  async findPublishedBySlug(slug: string, authorUsername?: string): Promise<PostDoc | null> {
    const filter: Filter<PostDoc> = { slug, status: "PUBLISHED" };
    if (authorUsername) filter.authorUsername = authorUsername;
    return this.col.findOne(filter);
  }

  async findFeed(opts: FeedOptions): Promise<{ data: PostDoc[]; total: number }> {
    const filter: Filter<PostDoc> = { status: "PUBLISHED" };

    if (opts.authorIds && opts.authorIds.length > 0) {
      filter.authorId = { $in: opts.authorIds };
    }
    if (opts.category) filter.category = opts.category;
    if (opts.tags && opts.tags.length > 0) filter.tags = { $in: opts.tags };

    const sort: Sort = opts.sort ?? { publishedAt: -1 };
    const skip = (opts.page - 1) * opts.limit;

    const [data, total] = await Promise.all([
      this.col.find(filter).sort(sort).skip(skip).limit(opts.limit).toArray(),
      this.col.countDocuments(filter),
    ]);

    return { data, total };
  }

  /**
   * Trending feed using the decay formula:
   * Score = (viewCount + likeCount×5 + commentCount×10) / (hoursSincePublish+2)^1.8
   */
  async findTrending(page: number, limit: number): Promise<{ data: PostDoc[]; total: number }> {
    const skip = (page - 1) * limit;

    // Only look at posts published within last 30 days for trending
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const pipeline = [
      { $match: { status: "PUBLISHED", publishedAt: { $gte: thirtyDaysAgo } } },
      {
        $addFields: {
          hoursSincePublish: {
            $divide: [
              { $subtract: [new Date(), "$publishedAt"] },
              3600000, // ms → hours
            ],
          },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $divide: [
              {
                $add: [
                  "$viewCount",
                  { $multiply: ["$likeCount", 5] },
                  { $multiply: ["$commentCount", 10] },
                ],
              },
              {
                $pow: [{ $add: ["$hoursSincePublish", 2] }, 1.8],
              },
            ],
          },
        },
      },
      { $sort: { trendingScore: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ];

    const result = await this.col.aggregate(pipeline).toArray();
    const facet = result[0] as { data: PostDoc[]; total: { count: number }[] };
    return {
      data: facet.data,
      total: facet.total[0]?.count ?? 0,
    };
  }

  async findByAuthor(
    authorUsername: string,
    page: number,
    limit: number
  ): Promise<{ data: PostDoc[]; total: number }> {
    const filter: Filter<PostDoc> = { authorUsername, status: "PUBLISHED" };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.col.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).toArray(),
      this.col.countDocuments(filter),
    ]);

    return { data, total };
  }

  async findRelated(postId: string, tags: string[], limit = 5): Promise<PostDoc[]> {
    return this.col
      .find({ postId: { $ne: postId }, status: "PUBLISHED", tags: { $in: tags } })
      .sort({ publishedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async findPopularTags(limit = 30): Promise<{ tag: string; count: number }[]> {
    const pipeline = [
      { $match: { status: "PUBLISHED" } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { tag: "$_id", count: 1, _id: 0 } },
    ];
    return this.col.aggregate<{ tag: string; count: number }>(pipeline).toArray();
  }
}
