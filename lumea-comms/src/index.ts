import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { handle } from "hono/aws-lambda";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { Pool } from "pg";

// ── DB ────────────────────────────────────────────────────────────────────────
let pool: Pool | null = null;
const getPool = () => {
  if (!pool) pool = new Pool({ connectionString: process.env.POSTGRES_DSN });
  return pool;
};
const getSES = () => new SESClient({ region: process.env.AWS_REGION ?? "us-east-1" });

// ── Email templates ───────────────────────────────────────────────────────────
const templates = {
  otp: (otp: string, name: string) => ({
    subject: "Your Lumea verification code",
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#1a1a1a;font-size:24px">Hi ${name},</h1>
  <p style="color:#555">Your verification code is:</p>
  <div style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
    <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#18181b">${otp}</span>
  </div>
  <p style="color:#888;font-size:14px">Valid for 10 minutes. Don't share this with anyone.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
  <p style="color:#aaa;font-size:12px">Lumea · Fill your paper with the breathings of your heart.</p>
</div>`,
  }),

  passwordReset: (token: string, name: string) => ({
    subject: "Reset your Lumea password",
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#1a1a1a">Hi ${name},</h1>
  <p>Click the link below to reset your password. Valid for 60 minutes.</p>
  <a href="${process.env.APP_URL}/reset-password?token=${token}"
     style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
    Reset Password
  </a>
  <p style="color:#888;font-size:14px">If you didn't request this, you can safely ignore this email.</p>
</div>`,
  }),

  welcome: (name: string, username: string) => ({
    subject: `Welcome to Lumea, ${name}!`,
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h1 style="color:#1a1a1a">Welcome, ${name}! 🎉</h1>
  <p>Your account <strong>@${username}</strong> is ready.</p>
  <a href="${process.env.APP_URL}"
     style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
    Start Reading
  </a>
  <p style="color:#888;font-size:14px">Lumea · Fill your paper with the breathings of your heart.</p>
</div>`,
  }),

  newFollower: (followerName: string, followerUsername: string, recipientName: string) => ({
    subject: `${followerName} started following you on Lumea`,
    html: `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <p>Hi ${recipientName},</p>
  <p><strong>${followerName}</strong> (@${followerUsername}) is now following you on Lumea.</p>
  <a href="${process.env.APP_URL}/u/${followerUsername}"
     style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0">
    View Profile
  </a>
</div>`,
  }),
};

// ── Send helper ───────────────────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string) {
  if (process.env.NODE_ENV === "development") {
    console.log(`📧 [EMAIL] to=${to} subject="${subject}"`);
    return;
  }
  await getSES().send(new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL ?? "noreply@lumea.ink",
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html } },
    },
  }));
}

// ── Log to DB ─────────────────────────────────────────────────────────────────
async function logEmail(to: string, subject: string, type: string, status: string) {
  try {
    await getPool().query(
      `INSERT INTO comms.email_log (recipient, subject, type, status, sent_at) VALUES ($1,$2,$3,$4,NOW())`,
      [to, subject, type, status]
    );
  } catch (e) { console.error("email log failed:", e); }
}

// ── Internal auth middleware ───────────────────────────────────────────────────
function requireInternal() {
  return async (c: any, next: any) => {
    const token = c.req.header("X-Internal-Token");
    if (token !== process.env.INTERNAL_SERVICE_TOKEN) {
      throw new HTTPException(403, { message: "Invalid internal token" });
    }
    await next();
  };
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = new OpenAPIHono();
app.use("*", logger());
app.use("*", cors());
app.get("/health", (c) => c.json({ status: "ok", service: "lumea-comms" }));

const E = z.object({ error: z.string() });
const M = z.object({ message: z.string() });

// ── POST /internal/send-otp ───────────────────────────────────────────────────
app.openapi(createRoute({
  method: "post", path: "/internal/send-otp", tags: ["Internal"],
  summary: "Send OTP email",
  request: {
    body: {
      content: { "application/json": { schema: z.object({ email: z.string().email(), otp: z.string(), name: z.string().default("there") }) } },
      required: true,
    },
  },
  responses: { 200: { description: "Sent", content: { "application/json": { schema: M } } } },
}), async (c) => {
  await requireInternal()(c, async () => {});
  const { email, otp, name } = c.req.valid("json");
  const { subject, html } = templates.otp(otp, name);
  await sendEmail(email, subject, html);
  await logEmail(email, subject, "otp", "sent");
  return c.json({ message: "OTP sent" });
});

// ── POST /internal/send-password-reset ───────────────────────────────────────
app.openapi(createRoute({
  method: "post", path: "/internal/send-password-reset", tags: ["Internal"],
  summary: "Send password reset email",
  request: {
    body: { content: { "application/json": { schema: z.object({ email: z.string().email(), token: z.string(), name: z.string().default("there") }) } }, required: true },
  },
  responses: { 200: { description: "Sent", content: { "application/json": { schema: M } } } },
}), async (c) => {
  await requireInternal()(c, async () => {});
  const { email, token, name } = c.req.valid("json");
  const { subject, html } = templates.passwordReset(token, name);
  await sendEmail(email, subject, html);
  await logEmail(email, subject, "password_reset", "sent");
  return c.json({ message: "Reset email sent" });
});

// ── POST /internal/send-welcome ───────────────────────────────────────────────
app.openapi(createRoute({
  method: "post", path: "/internal/send-welcome", tags: ["Internal"],
  summary: "Send welcome email",
  request: {
    body: { content: { "application/json": { schema: z.object({ email: z.string().email(), name: z.string(), username: z.string() }) } }, required: true },
  },
  responses: { 200: { description: "Sent", content: { "application/json": { schema: M } } } },
}), async (c) => {
  await requireInternal()(c, async () => {});
  const { email, name, username } = c.req.valid("json");
  const { subject, html } = templates.welcome(name, username);
  await sendEmail(email, subject, html);
  await logEmail(email, subject, "welcome", "sent");
  return c.json({ message: "Welcome email sent" });
});

// ── POST /internal/send-new-follower ─────────────────────────────────────────
app.openapi(createRoute({
  method: "post", path: "/internal/send-new-follower", tags: ["Internal"],
  summary: "New follower notification email",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            recipientEmail: z.string().email(), recipientName: z.string(),
            followerName: z.string(), followerUsername: z.string(),
          }),
        },
      },
      required: true,
    },
  },
  responses: { 200: { description: "Sent", content: { "application/json": { schema: M } } } },
}), async (c) => {
  await requireInternal()(c, async () => {});
  const { recipientEmail, recipientName, followerName, followerUsername } = c.req.valid("json");
  const { subject, html } = templates.newFollower(followerName, followerUsername, recipientName);
  await sendEmail(recipientEmail, subject, html);
  await logEmail(recipientEmail, subject, "new_follower", "sent");
  return c.json({ message: "Notification sent" });
});

// ── OpenAPI ───────────────────────────────────────────────────────────────────
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: { title: "Lumea Communication Service", version: "1.0.0", description: "Internal email service. All routes require X-Internal-Token header." },
});
app.get("/docs", swaggerUI({ url: "/openapi.json" }));
app.onError((err, c) => err instanceof HTTPException ? c.json({ error: err.message }, err.status) : c.json({ error: "Internal error" }, 500));

export const handler = handle(app);
export default app;
