import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";
import { MongoClient, Db } from "mongodb";
import { Redis } from "@upstash/redis";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

// ── Types ─────────────────────────────────────────────────────────────────────
interface JWTPayload { user_id: string; username: string; email: string; role: string; plan: string; jti: string; exp: number; }

// ── DB singletons ──────────────────────────────────────────────────────────────
let _mongo: MongoClient | null = null;
async function getDb(): Promise<Db> {
  if (!_mongo) { _mongo = new MongoClient(process.env.MONGODB_URI!); await _mongo.connect(); }
  return _mongo.db("lumea");
}
const getRedis = () => new Redis({ url: process.env.UPSTASH_REDIS_URL!, token: process.env.UPSTASH_REDIS_TOKEN! });
const getSNS = () => new SNSClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// ── JWT verify ────────────────────────────────────────────────────────────────
async function verifyJWT(header: string | undefined): Promise<JWTPayload | null> {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const [h, p, s] = header.slice(7).split(".");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(process.env.JWT_SECRET!), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const decode = (str: string) => { const pad = str + "=".repeat((4 - str.length % 4) % 4); const b = atob(pad.replace(/-/g, "+").replace(/_/g, "/")); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    const ok = await crypto.subtle.verify("HMAC", key, decode(s), enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const pl = JSON.parse(new TextDecoder().decode(decode(p))) as JWTPayload;
    return pl.exp > Date.now() / 1000 ? pl : null;
  } catch { return null; }
}

// ── SNS event publisher ───────────────────────────────────────────────────────
async function publishEvent(eventType: string, data: Record<string, unknown>) {
  if (!process.env.SNS_TOPIC_ARN) return;
  try {
    await getSNS().send(new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify({ eventType, data, timestamp: new Date().toISOString() }),
      MessageAttributes: { eventType: { DataType: "String", StringValue: eventType } },
    }));
  } catch (e) { console.error("SNS publish failed:", e); }
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = new OpenAPIHono();
const _apiKeys = new Set((process.env.API_KEYS ?? "").split("-").filter(Boolean));
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || _apiKeys.size === 0) return next();
  if (!_apiKeys.has(c.req.header("X-API-Key") ?? "")) return c.json({ error: "Invalid or missing API key" }, 401);
  return next();
});
app.use("*", logger());
app.use("*", cors({ origin: ["http://localhost:3000", "https://lumea.ink", "https://dash.lumea.ink"], allowHeaders: ["Authorization", "Content-Type"], credentials: true }));
app.get("/health", (c) => c.json({ status: "ok", service: "lumea-interaction" }));

const E = z.object({ error: z.string() }).openapi("Error");
const M = z.object({ message: z.string() }).openapi("Message");
const PID = z.object({ postId: z.string().uuid() });
const CID = z.object({ commentId: z.string() });

// ════════════════════════════════════════════════════════════════════
// LIKES
// ════════════════════════════════════════════════════════════════════

app.openapi(createRoute({
  method: "post", path: "/api/posts/{postId}/like", tags: ["Likes"],
  summary: "Like a post", security: [{ BearerAuth: [] }],
  request: { params: PID },
  responses: { 200: { description: "Liked", content: { "application/json": { schema: M } } }, 409: { description: "Already liked", content: { "application/json": { schema: E } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { postId } = c.req.valid("param");
  const db = await getDb();

  const existing = await db.collection("likes").findOne({ postId, userId: user.user_id });
  if (existing) throw new HTTPException(409, { message: "Already liked" });

  await db.collection("likes").insertOne({ postId, userId: user.user_id, createdAt: new Date() });
  await db.collection("posts").updateOne({ postId }, { $inc: { likeCount: 1 } });
  publishEvent("post.liked", { postId, userId: user.user_id, username: user.username });
  return c.json({ message: "Post liked" });
});

app.openapi(createRoute({
  method: "delete", path: "/api/posts/{postId}/like", tags: ["Likes"],
  summary: "Unlike a post", security: [{ BearerAuth: [] }],
  request: { params: PID },
  responses: { 200: { description: "Unliked", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { postId } = c.req.valid("param");
  const db = await getDb();

  const result = await db.collection("likes").deleteOne({ postId, userId: user.user_id });
  if (result.deletedCount > 0) await db.collection("posts").updateOne({ postId }, { $inc: { likeCount: -1 } });
  return c.json({ message: "Post unliked" });
});

app.openapi(createRoute({
  method: "get", path: "/api/posts/{postId}/like", tags: ["Likes"],
  summary: "Like status",
  request: { params: PID },
  responses: { 200: { description: "Status", content: { "application/json": { schema: z.object({ liked: z.boolean(), count: z.number() }).openapi("LikeStatus") } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  const { postId } = c.req.valid("param");
  const db = await getDb();

  const [count, liked] = await Promise.all([
    db.collection("likes").countDocuments({ postId }),
    user ? db.collection("likes").findOne({ postId, userId: user.user_id }).then(Boolean) : false,
  ]);
  return c.json({ liked, count });
});

// ════════════════════════════════════════════════════════════════════
// COMMENTS
// ════════════════════════════════════════════════════════════════════

const CommentBody = z.object({ content: z.string().min(1).max(2000), parentId: z.string().optional() });
const CommentSchema = z.object({
  _id: z.string(), postId: z.string(), authorId: z.string(), authorUsername: z.string(),
  authorName: z.string(), authorPicture: z.string().optional(), content: z.string(),
  parentId: z.string().optional(), likeCount: z.number(), isEdited: z.boolean(), createdAt: z.string(),
}).openapi("Comment");

app.openapi(createRoute({
  method: "post", path: "/api/posts/{postId}/comments", tags: ["Comments"],
  summary: "Add comment", security: [{ BearerAuth: [] }],
  request: { params: PID, body: { content: { "application/json": { schema: CommentBody } }, required: true } },
  responses: { 201: { description: "Comment created", content: { "application/json": { schema: CommentSchema } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { postId } = c.req.valid("param");
  const { content, parentId } = c.req.valid("json");
  const db = await getDb();

  const comment = {
    postId, authorId: user.user_id, authorUsername: user.username,
    authorName: user.username, content, parentId,
    likeCount: 0, isEdited: false, createdAt: new Date(),
  };
  const result = await db.collection("comments").insertOne(comment);
  await db.collection("posts").updateOne({ postId }, { $inc: { commentCount: 1 } });
  publishEvent("comment.added", { postId, commentId: result.insertedId.toString(), userId: user.user_id });

  return c.json({ ...comment, _id: result.insertedId.toString(), createdAt: comment.createdAt.toISOString() }, 201);
});

app.openapi(createRoute({
  method: "get", path: "/api/posts/{postId}/comments", tags: ["Comments"],
  summary: "Get comments",
  request: {
    params: PID,
    query: z.object({ page: z.string().pipe(z.coerce.number()).default("1"), limit: z.string().pipe(z.coerce.number()).default("20") }),
  },
  responses: { 200: { description: "Comments", content: { "application/json": { schema: z.object({ data: z.array(CommentSchema), total: z.number() }) } } } },
}), async (c) => {
  const { postId } = c.req.valid("param");
  const { page, limit } = c.req.valid("query");
  const db = await getDb();
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.collection("comments").find({ postId, parentId: { $exists: false } }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection("comments").countDocuments({ postId, parentId: { $exists: false } }),
  ]);

  return c.json({ data: data.map(d => ({ ...d, _id: d._id.toString(), createdAt: d.createdAt.toISOString() })), total });
});

app.openapi(createRoute({
  method: "delete", path: "/api/comments/{commentId}", tags: ["Comments"],
  summary: "Delete comment", security: [{ BearerAuth: [] }],
  request: { params: CID },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { commentId } = c.req.valid("param");
  const db = await getDb();
  const { ObjectId } = await import("mongodb");

  const comment = await db.collection("comments").findOne({ _id: new ObjectId(commentId) });
  if (!comment) throw new HTTPException(404, { message: "Comment not found" });
  if (comment.authorId !== user.user_id && user.role !== "ADMIN") throw new HTTPException(403, { message: "Forbidden" });

  await db.collection("comments").deleteOne({ _id: new ObjectId(commentId) });
  await db.collection("posts").updateOne({ postId: comment.postId }, { $inc: { commentCount: -1 } });
  return c.json({ message: "Comment deleted" });
});

// ════════════════════════════════════════════════════════════════════
// BOOKMARKS
// ════════════════════════════════════════════════════════════════════

app.openapi(createRoute({
  method: "post", path: "/api/posts/{postId}/bookmark", tags: ["Bookmarks"],
  summary: "Bookmark a post", security: [{ BearerAuth: [] }],
  request: { params: PID },
  responses: { 200: { description: "Bookmarked", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { postId } = c.req.valid("param");
  const db = await getDb();

  await db.collection("bookmarks").updateOne(
    { postId, userId: user.user_id },
    { $setOnInsert: { postId, userId: user.user_id, createdAt: new Date() } },
    { upsert: true }
  );
  return c.json({ message: "Post bookmarked" });
});

app.openapi(createRoute({
  method: "delete", path: "/api/posts/{postId}/bookmark", tags: ["Bookmarks"],
  summary: "Remove bookmark", security: [{ BearerAuth: [] }],
  request: { params: PID },
  responses: { 200: { description: "Removed", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { postId } = c.req.valid("param");
  const db = await getDb();
  await db.collection("bookmarks").deleteOne({ postId, userId: user.user_id });
  return c.json({ message: "Bookmark removed" });
});

app.openapi(createRoute({
  method: "get", path: "/api/users/bookmarks", tags: ["Bookmarks"],
  summary: "My bookmarks", security: [{ BearerAuth: [] }],
  request: { query: z.object({ page: z.string().pipe(z.coerce.number()).default("1"), limit: z.string().pipe(z.coerce.number()).default("20") }) },
  responses: { 200: { description: "Bookmarks", content: { "application/json": { schema: z.object({ data: z.array(z.object({ postId: z.string(), createdAt: z.string() })), total: z.number() }) } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { page, limit } = c.req.valid("query");
  const db = await getDb();
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    db.collection("bookmarks").find({ userId: user.user_id }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection("bookmarks").countDocuments({ userId: user.user_id }),
  ]);
  return c.json({ data: data.map(d => ({ postId: d.postId, createdAt: d.createdAt.toISOString() })), total });
});

// ════════════════════════════════════════════════════════════════════
// VIEW TRACKING
// ════════════════════════════════════════════════════════════════════

app.openapi(createRoute({
  method: "post", path: "/api/posts/{postId}/view", tags: ["Views"],
  summary: "Record a post view",
  description: "Increments view count. Deduplication via Redis (1 view per user/IP per 24h).",
  request: { params: PID },
  responses: { 200: { description: "Recorded", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  const { postId } = c.req.valid("param");
  const viewKey = user ? `view:${postId}:u:${user.user_id}` : `view:${postId}:ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`;

  const redis = getRedis();
  const already = await redis.exists(viewKey);
  if (already) return c.json({ message: "Already counted" });

  await redis.set(viewKey, "1", { ex: 86400 }); // 24h dedup
  const db = await getDb();
  await db.collection("posts").updateOne({ postId }, { $inc: { viewCount: 1 } });
  publishEvent("post.viewed", { postId, userId: user?.user_id });
  return c.json({ message: "View recorded" });
});

// ── OpenAPI ───────────────────────────────────────────────────────────────────
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Lumea Interaction Service", version: "1.0.0" },
  components: { securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
});
app.get("/docs", swaggerUI({ url: "/openapi.json" }));
app.onError((err, c) => err instanceof HTTPException ? c.json({ error: err.message }, err.status) : c.json({ error: "Internal error" }, 500));

export const handler = handle(app);
export default app;
