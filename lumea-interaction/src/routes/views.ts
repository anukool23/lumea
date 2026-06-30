import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../types/env.d";
import { tryGetAuthUser } from "../middleware/auth";
import { getDb, COLLECTIONS } from "../lib/mongodb";
import { getRedis, RedisKeys } from "../lib/redis";
import { publishEvent } from "../lib/sns";
import { PostIdParam, MessageSchema } from "../models/interaction";

const app = new OpenAPIHono<AppEnv>();

// ── POST /api/posts/:postId/view ──────────────────────────────────────────────

const recordViewRoute = createRoute({
  method: "post",
  path: "/api/posts/{postId}/view",
  tags: ["Views"],
  summary: "Record a post view",
  description:
    "Increments the post view counter. Deduplication via Redis — 1 view per user/IP per 24 h.",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: { params: PostIdParam },
  responses: {
    200: { description: "View recorded or already counted", content: { "application/json": { schema: MessageSchema } } },
  },
});

const recordViewHandler: RouteHandler<typeof recordViewRoute, AppEnv> = async (c) => {
  const user = await tryGetAuthUser(c);
  const { postId } = c.req.valid("param");

  // Dedup key: per user-id if authenticated, per IP otherwise
  const dedupId = user
    ? `u:${user.user_id}`
    : `ip:${c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown"}`;

  const redis = getRedis();
  const viewKey = RedisKeys.viewDedup(postId, dedupId);

  const already = await redis.exists(viewKey);
  if (already) return c.json({ message: "Already counted" }, 200);

  await redis.set(viewKey, "1", { ex: 86400 }); // 24 h TTL

  const db = await getDb(process.env.MONGODB_URI!);
  await db.collection(COLLECTIONS.POSTS).updateOne({ postId }, { $inc: { viewCount: 1 } });

  // Fire-and-forget SNS event — failure is non-fatal
  void publishEvent("post.viewed", { postId, userId: user?.user_id });

  return c.json({ message: "View recorded" }, 200);
};

app.openapi(recordViewRoute, recordViewHandler);

export default app;
