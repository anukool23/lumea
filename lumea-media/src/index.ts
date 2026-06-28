import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

interface Env {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  JWT_SECRET: string;
  // BFF API Keys — same format as other services: key1-key2-key3-key4
  API_KEYS: string;
}

const app = new OpenAPIHono<{ Bindings: Env }>();

app.use("*", cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "https://lumea.ink", "https://dash.lumea.ink"],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowHeaders: ["Authorization", "Content-Type", "X-API-Key"],
  credentials: true,
}));

// X-API-Key validation (uses c.env because this is a CF Worker)
app.use("*", async (c, next) => {
  if (c.req.path === "/health") return next();
  const keys = new Set((c.env.API_KEYS ?? "").split("-").filter(Boolean));
  if (keys.size === 0) return next();
  if (!keys.has(c.req.header("X-API-Key") ?? "")) {
    return c.json({ error: "Invalid or missing API key" }, 401);
  }
  return next();
});

app.get("/health", (c) => c.json({ status: "ok", service: "lumea-media" }));

// ── Auth middleware ────────────────────────────────────────────────────────────
async function getUser(header: string | undefined, secret: string) {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const token = header.slice(7);
    const [hb, pb, sb] = token.split(".");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const decode = (s: string) => { const p = s + "=".repeat((4 - s.length % 4) % 4); const b = atob(p.replace(/-/g, "+").replace(/_/g, "/")); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    const valid = await crypto.subtle.verify("HMAC", key, decode(sb), enc.encode(`${hb}.${pb}`));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(decode(pb)));
    if (payload.exp < Date.now() / 1000) return null;
    return payload as { user_id: string; username: string };
  } catch { return null; }
}

// ── POST /api/media/sign-upload ───────────────────────────────────────────────

const signUploadRoute = createRoute({
  method: "post",
  path: "/api/media/sign-upload",
  tags: ["Media"],
  summary: "Get signed Cloudinary upload URL",
  description: "Returns a signed upload signature. The browser uploads directly to Cloudinary — the API secret never leaves the server.",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            folder: z.enum(["covers", "avatars", "content"]).default("content").openapi({ example: "covers" }),
            filename: z.string().max(100).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Upload credentials",
      content: {
        "application/json": {
          schema: z.object({
            signature: z.string(),
            timestamp: z.number(),
            api_key: z.string(),
            cloud_name: z.string(),
            folder: z.string(),
            upload_url: z.string(),
          }).openapi("UploadCredentials"),
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/json": { schema: z.object({ error: z.string() }) } } },
  },
});

app.openapi(signUploadRoute, async (c) => {
  const user = await getUser(c.req.header("Authorization"), c.env.JWT_SECRET);
  if (!user) throw new HTTPException(401, { message: "Authorization required" });

  const { folder } = c.req.valid("json");
  const timestamp = Math.round(Date.now() / 1000);

  // Cloudinary signature: SHA-1 of "folder=X&timestamp=Y" + API_SECRET
  const paramStr = `folder=${folder}&timestamp=${timestamp}`;
  const msgBuffer = new TextEncoder().encode(paramStr + c.env.CLOUDINARY_API_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  return c.json({
    signature,
    timestamp,
    api_key: c.env.CLOUDINARY_API_KEY,
    cloud_name: c.env.CLOUDINARY_CLOUD_NAME,
    folder,
    upload_url: `https://api.cloudinary.com/v1_1/${c.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
  });
});

// ── DELETE /api/media/:publicId ───────────────────────────────────────────────

const deleteMediaRoute = createRoute({
  method: "delete",
  path: "/api/media/{publicId}",
  tags: ["Media"],
  summary: "Delete a media asset",
  description: "Deletes an asset from Cloudinary by public_id.",
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ publicId: z.string() }) },
  responses: {
    200: { description: "Deleted", content: { "application/json": { schema: z.object({ message: z.string() }) } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: z.object({ error: z.string() }) } } },
  },
});

app.openapi(deleteMediaRoute, async (c) => {
  const user = await getUser(c.req.header("Authorization"), c.env.JWT_SECRET);
  if (!user) throw new HTTPException(401, { message: "Authorization required" });

  const { publicId } = c.req.valid("param");
  const timestamp = Math.round(Date.now() / 1000);
  const paramStr = `public_id=${publicId}&timestamp=${timestamp}`;
  const msgBuffer = new TextEncoder().encode(paramStr + c.env.CLOUDINARY_API_SECRET);
  const hashBuffer = await crypto.subtle.digest("SHA-1", msgBuffer);
  const signature = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("signature", signature);
  formData.append("api_key", c.env.CLOUDINARY_API_KEY);
  formData.append("timestamp", String(timestamp));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${c.env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
    { method: "POST", body: formData }
  );

  if (!res.ok) throw new HTTPException(500, { message: "Cloudinary delete failed" });
  return c.json({ message: "Asset deleted" });
});

// ── OpenAPI ───────────────────────────────────────────────────────────────────

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Lumea Media Service", version: "1.0.0", description: "Cloudinary signed upload URLs and asset management." },
  components: { securitySchemes: { BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
});
app.get("/docs", swaggerUI({ url: "/openapi.json" }));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  return c.json({ error: "Internal error" }, 500);
});

export default app;
