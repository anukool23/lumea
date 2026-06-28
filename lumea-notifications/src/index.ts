import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";
import { MongoClient, Db, ObjectId } from "mongodb";

// ── DB ────────────────────────────────────────────────────────────────────────
let _mongo: MongoClient | null = null;
async function getDb(): Promise<Db> {
  if (!_mongo) { _mongo = new MongoClient(process.env.MONGODB_URI!); await _mongo.connect(); }
  return _mongo.db("lumea");
}

// ── JWT verify ────────────────────────────────────────────────────────────────
async function verifyJWT(header: string | undefined): Promise<{ user_id: string } | null> {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const [h, p, s] = header.slice(7).split(".");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(process.env.JWT_SECRET!), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const decode = (str: string) => { const pad = str + "=".repeat((4 - str.length % 4) % 4); const b = atob(pad.replace(/-/g, "+").replace(/_/g, "/")); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    const ok = await crypto.subtle.verify("HMAC", key, decode(s), enc.encode(`${h}.${p}`));
    if (!ok) return null;
    const pl = JSON.parse(new TextDecoder().decode(decode(p)));
    return pl.exp > Date.now() / 1000 ? pl : null;
  } catch { return null; }
}

// ── Schemas ───────────────────────────────────────────────────────────────────
const NotificationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  type: z.enum(["follow", "like", "comment", "reply", "system", "badge", "supporter"]),
  title: z.string(),
  body: z.string(),
  link: z.string().optional(),
  actorId: z.string().optional(),
  actorUsername: z.string().optional(),
  actorPicture: z.string().optional(),
  isRead: z.boolean(),
  createdAt: z.string(),
}).openapi("Notification");

const M = z.object({ message: z.string() });
const E = z.object({ error: z.string() });

// ── App ───────────────────────────────────────────────────────────────────────
const app = new OpenAPIHono();
const _apiKeys = new Set((process.env.API_KEYS ?? "").split("-").filter(Boolean));
app.use("*", async (c, next) => {
  if (c.req.path === "/health" || _apiKeys.size === 0) return next();
  // /internal/* is protected by X-Internal-Token, not X-API-Key
  if (c.req.path.startsWith("/internal/")) return next();
  if (!_apiKeys.has(c.req.header("X-API-Key") ?? "")) return c.json({ error: "Invalid or missing API key" }, 401);
  return next();
});
app.use("*", logger());
app.use("*", cors({ origin: ["http://localhost:3000", "https://lumea.ink", "https://dash.lumea.ink"], allowHeaders: ["Authorization", "Content-Type"], credentials: true }));
app.get("/health", (c) => c.json({ status: "ok", service: "lumea-notifications" }));

// ── GET /api/notifications ────────────────────────────────────────────────────
app.openapi(createRoute({
  method: "get", path: "/api/notifications", tags: ["Notifications"],
  summary: "Get my notifications", security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      page: z.string().pipe(z.coerce.number()).default("1"),
      limit: z.string().pipe(z.coerce.number()).default("20"),
      unreadOnly: z.string().pipe(z.coerce.boolean()).default("false"),
    }),
  },
  responses: {
    200: {
      description: "Notifications",
      content: { "application/json": { schema: z.object({ data: z.array(NotificationSchema), total: z.number(), unreadCount: z.number() }) } },
    },
  },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { page, limit, unreadOnly } = c.req.valid("query");
  const db = await getDb();

  const filter: any = { userId: user.user_id };
  if (unreadOnly) filter.isRead = false;

  const skip = (page - 1) * limit;
  const [data, total, unreadCount] = await Promise.all([
    db.collection("notifications").find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection("notifications").countDocuments(filter),
    db.collection("notifications").countDocuments({ userId: user.user_id, isRead: false }),
  ]);

  return c.json({
    data: data.map((n: any) => ({ ...n, _id: n._id.toString(), createdAt: n.createdAt.toISOString() })),
    total,
    unreadCount,
  });
});

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────
app.openapi(createRoute({
  method: "patch", path: "/api/notifications/{id}/read", tags: ["Notifications"],
  summary: "Mark notification as read", security: [{ BearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "Updated", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { id } = c.req.valid("param");
  const db = await getDb();

  await db.collection("notifications").updateOne(
    { _id: new ObjectId(id), userId: user.user_id },
    { $set: { isRead: true } }
  );
  return c.json({ message: "Marked as read" });
});

// ── PATCH /api/notifications/read-all ────────────────────────────────────────
app.openapi(createRoute({
  method: "patch", path: "/api/notifications/read-all", tags: ["Notifications"],
  summary: "Mark all notifications as read", security: [{ BearerAuth: [] }],
  responses: { 200: { description: "Updated", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const db = await getDb();
  await db.collection("notifications").updateMany({ userId: user.user_id, isRead: false }, { $set: { isRead: true } });
  return c.json({ message: "All marked as read" });
});

// ── DELETE /api/notifications/:id ────────────────────────────────────────────
app.openapi(createRoute({
  method: "delete", path: "/api/notifications/{id}", tags: ["Notifications"],
  summary: "Delete a notification", security: [{ BearerAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: "Deleted", content: { "application/json": { schema: M } } } },
}), async (c) => {
  const user = await verifyJWT(c.req.header("Authorization"));
  if (!user) throw new HTTPException(401, { message: "Unauthorized" });
  const { id } = c.req.valid("param");
  const db = await getDb();
  await db.collection("notifications").deleteOne({ _id: new ObjectId(id), userId: user.user_id });
  return c.json({ message: "Notification deleted" });
});

// ── POST /internal/notifications — create notification ────────────────────────
app.openapi(createRoute({
  method: "post", path: "/internal/notifications", tags: ["Internal"],
  summary: "Create notification (internal)",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            userId: z.string(),
            type: z.enum(["follow", "like", "comment", "reply", "system", "badge", "supporter"]),
            title: z.string(),
            body: z.string(),
            link: z.string().optional(),
            actorId: z.string().optional(),
            actorUsername: z.string().optional(),
            actorPicture: z.string().optional(),
          }),
        },
      },
      required: true,
    },
  },
  responses: { 201: { description: "Created", content: { "application/json": { schema: z.object({ id: z.string() }) } } } },
}), async (c) => {
  const token = c.req.header("X-Internal-Token");
  if (token !== process.env.INTERNAL_SERVICE_TOKEN) throw new HTTPException(403, { message: "Forbidden" });

  const body = c.req.valid("json");
  const db = await getDb();
  const result = await db.collection("notifications").insertOne({ ...body, isRead: false, createdAt: new Date() });
  return c.json({ id: result.insertedId.toString() }, 201);
});

// ── OpenAPI ───────────────────────────────────────────────────────────────────
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Lumea Notification Service", version: "1.0.0" },
  components: { securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
});
app.get("/docs", swaggerUI({ url: "/openapi.json" }));
app.onError((err, c) => err instanceof HTTPException ? c.json({ error: err.message }, err.status) : c.json({ error: "Internal error" }, 500));

export const handler = handle(app);
export default app;
