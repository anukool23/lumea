import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { ObjectId } from "mongodb";
import type { AppEnv } from "../types/env.d";
import { getDb, COLLECTIONS } from "../lib/mongodb";
import { getAuthUser } from "../middleware/auth";
import { checkInternalToken } from "../middleware/internal-auth";

const router = new OpenAPIHono<AppEnv>();

// ── Schemas ───────────────────────────────────────────────────────────────────

const NotificationTypeEnum = z.enum([
  "follow", "like", "comment", "reply", "system", "badge", "supporter",
]);

const NotificationSchema = z.object({
  _id:             z.string(),
  userId:          z.string(),
  type:            NotificationTypeEnum,
  title:           z.string(),
  body:            z.string(),
  link:            z.string().optional(),
  actorId:         z.string().optional(),
  actorUsername:   z.string().optional(),
  actorPicture:    z.string().optional(),
  isRead:          z.boolean(),
  createdAt:       z.string(),
});

const MessageSchema = z.object({ message: z.string() });
const ErrorSchema   = z.object({ error: z.string() });

// ── GET /api/notifications ────────────────────────────────────────────────────

const listRoute = createRoute({
  method: "get",
  path: "/api/notifications",
  tags: ["Notifications"],
  summary: "Get my notifications",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    query: z.object({
      page:       z.string().pipe(z.coerce.number().int().min(1)).default("1"),
      limit:      z.string().pipe(z.coerce.number().int().min(1).max(100)).default("20"),
      unreadOnly: z.string().pipe(z.coerce.boolean()).default("false"),
    }),
  },
  responses: {
    200: {
      description: "Notifications list",
      content: {
        "application/json": {
          schema: z.object({
            data:        z.array(NotificationSchema),
            total:       z.number(),
            unreadCount: z.number(),
          }),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const listHandler: RouteHandler<typeof listRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { page, limit, unreadOnly } = c.req.valid("query");
  const db = await getDb();

  const filter: Record<string, unknown> = { userId: user.user_id };
  if (unreadOnly) filter["isRead"] = false;

  const skip = (page - 1) * limit;
  const [data, total, unreadCount] = await Promise.all([
    db.collection(COLLECTIONS.NOTIFICATIONS)
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection(COLLECTIONS.NOTIFICATIONS).countDocuments(filter),
    db.collection(COLLECTIONS.NOTIFICATIONS).countDocuments({ userId: user.user_id, isRead: false }),
  ]);

  return c.json({
    data: data.map((n) => ({
      _id:           (n["_id"] as ObjectId).toString(),
      userId:        n["userId"] as string,
      type:          n["type"] as z.infer<typeof NotificationTypeEnum>,
      title:         n["title"] as string,
      body:          n["body"] as string,
      link:          n["link"] as string | undefined,
      actorId:       n["actorId"] as string | undefined,
      actorUsername: n["actorUsername"] as string | undefined,
      actorPicture:  n["actorPicture"] as string | undefined,
      isRead:        n["isRead"] as boolean,
      createdAt:     (n["createdAt"] as Date).toISOString(),
    })),
    total,
    unreadCount,
  }, 200);
};

router.openapi(listRoute, listHandler);

// ── PATCH /api/notifications/:id/read ────────────────────────────────────────

const markReadRoute = createRoute({
  method: "patch",
  path: "/api/notifications/{id}/read",
  tags: ["Notifications"],
  summary: "Mark a notification as read",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
    404: { description: "Not found",    content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const markReadHandler: RouteHandler<typeof markReadRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { id } = c.req.valid("param");
  const db = await getDb();

  await db.collection(COLLECTIONS.NOTIFICATIONS).updateOne(
    { _id: new ObjectId(id), userId: user.user_id },
    { $set: { isRead: true } }
  );
  return c.json({ message: "Marked as read" }, 200);
};

router.openapi(markReadRoute, markReadHandler);

// ── PATCH /api/notifications/read-all ────────────────────────────────────────

const markAllReadRoute = createRoute({
  method: "patch",
  path: "/api/notifications/read-all",
  tags: ["Notifications"],
  summary: "Mark all notifications as read",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const markAllReadHandler: RouteHandler<typeof markAllReadRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const db = await getDb();

  await db.collection(COLLECTIONS.NOTIFICATIONS).updateMany(
    { userId: user.user_id, isRead: false },
    { $set: { isRead: true } }
  );
  return c.json({ message: "All marked as read" }, 200);
};

router.openapi(markAllReadRoute, markAllReadHandler);

// ── DELETE /api/notifications/:id ────────────────────────────────────────────

const deleteRoute = createRoute({
  method: "delete",
  path: "/api/notifications/{id}",
  tags: ["Notifications"],
  summary: "Delete a notification",
  security: [{ BearerAuth: [] }, { APIKeyAuth: [] }] as const,
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: { description: "Deleted",      content: { "application/json": { schema: MessageSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const deleteHandler: RouteHandler<typeof deleteRoute, AppEnv> = async (c) => {
  const user = await getAuthUser(c);
  const { id } = c.req.valid("param");
  const db = await getDb();

  await db.collection(COLLECTIONS.NOTIFICATIONS).deleteOne({
    _id: new ObjectId(id),
    userId: user.user_id,
  });
  return c.json({ message: "Notification deleted" }, 200);
};

router.openapi(deleteRoute, deleteHandler);

// ── POST /internal/notifications — create (internal) ─────────────────────────

const createInternalRoute = createRoute({
  method: "post",
  path: "/internal/notifications",
  tags: ["Internal"],
  summary: "Create notification (called by other services)",
  security: [{ InternalTokenAuth: [] }] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            userId:        z.string(),
            type:          NotificationTypeEnum,
            title:         z.string(),
            body:          z.string(),
            link:          z.string().optional(),
            actorId:       z.string().optional(),
            actorUsername: z.string().optional(),
            actorPicture:  z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Created",  content: { "application/json": { schema: z.object({ id: z.string() }) } } },
    403: { description: "Forbidden", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const createInternalHandler: RouteHandler<typeof createInternalRoute, AppEnv> = async (c) => {
  checkInternalToken(c);
  const body = c.req.valid("json");
  const db = await getDb();

  const result = await db.collection(COLLECTIONS.NOTIFICATIONS).insertOne({
    ...body,
    isRead:    false,
    createdAt: new Date(),
  });
  return c.json({ id: result.insertedId.toString() }, 201);
};

router.openapi(createInternalRoute, createInternalHandler);

export default router;
