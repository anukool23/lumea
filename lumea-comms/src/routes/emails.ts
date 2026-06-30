import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../types/env.d";
import { sendEmail } from "../lib/ses";
import { logEmail } from "../lib/db";
import { templates } from "../lib/templates";

const router = new OpenAPIHono<AppEnv>();

// ── Shared schemas ────────────────────────────────────────────────────────────

const MessageSchema = z.object({ message: z.string() });
const ErrorSchema   = z.object({ error: z.string() });

// ── POST /internal/send-otp ───────────────────────────────────────────────────

const sendOtpRoute = createRoute({
  method: "post",
  path: "/internal/send-otp",
  tags: ["Internal"],
  summary: "Send OTP verification email",
  security: [{ InternalTokenAuth: [] }] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            otp:   z.string().min(4).max(8),
            name:  z.string().default("there"),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Email sent", content: { "application/json": { schema: MessageSchema } } },
    500: { description: "Send failed", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const sendOtpHandler: RouteHandler<typeof sendOtpRoute, AppEnv> = async (c) => {
  const { email, otp, name } = c.req.valid("json");
  const { subject, html } = templates.otp(otp, name);
  await sendEmail(email, subject, html);
  await logEmail(email, subject, "otp", "sent");
  return c.json({ message: "OTP sent" }, 200);
};

router.openapi(sendOtpRoute, sendOtpHandler);

// ── POST /internal/send-password-reset ───────────────────────────────────────

const sendPasswordResetRoute = createRoute({
  method: "post",
  path: "/internal/send-password-reset",
  tags: ["Internal"],
  summary: "Send password reset email",
  security: [{ InternalTokenAuth: [] }] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            email: z.string().email(),
            token: z.string(),
            name:  z.string().default("there"),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Email sent", content: { "application/json": { schema: MessageSchema } } },
    500: { description: "Send failed", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const sendPasswordResetHandler: RouteHandler<typeof sendPasswordResetRoute, AppEnv> = async (c) => {
  const { email, token, name } = c.req.valid("json");
  const { subject, html } = templates.passwordReset(token, name);
  await sendEmail(email, subject, html);
  await logEmail(email, subject, "password_reset", "sent");
  return c.json({ message: "Reset email sent" }, 200);
};

router.openapi(sendPasswordResetRoute, sendPasswordResetHandler);

// ── POST /internal/send-welcome ───────────────────────────────────────────────

const sendWelcomeRoute = createRoute({
  method: "post",
  path: "/internal/send-welcome",
  tags: ["Internal"],
  summary: "Send welcome email after registration",
  security: [{ InternalTokenAuth: [] }] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            email:    z.string().email(),
            name:     z.string(),
            username: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Email sent", content: { "application/json": { schema: MessageSchema } } },
    500: { description: "Send failed", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const sendWelcomeHandler: RouteHandler<typeof sendWelcomeRoute, AppEnv> = async (c) => {
  const { email, name, username } = c.req.valid("json");
  const { subject, html } = templates.welcome(name, username);
  await sendEmail(email, subject, html);
  await logEmail(email, subject, "welcome", "sent");
  return c.json({ message: "Welcome email sent" }, 200);
};

router.openapi(sendWelcomeRoute, sendWelcomeHandler);

// ── POST /internal/send-new-follower ─────────────────────────────────────────

const sendNewFollowerRoute = createRoute({
  method: "post",
  path: "/internal/send-new-follower",
  tags: ["Internal"],
  summary: "Send new-follower notification email",
  security: [{ InternalTokenAuth: [] }] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: z.object({
            recipientEmail:    z.string().email(),
            recipientName:     z.string(),
            followerName:      z.string(),
            followerUsername:  z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Email sent", content: { "application/json": { schema: MessageSchema } } },
    500: { description: "Send failed", content: { "application/json": { schema: ErrorSchema } } },
  },
} as const);

const sendNewFollowerHandler: RouteHandler<typeof sendNewFollowerRoute, AppEnv> = async (c) => {
  const { recipientEmail, recipientName, followerName, followerUsername } = c.req.valid("json");
  const { subject, html } = templates.newFollower(followerName, followerUsername, recipientName);
  await sendEmail(recipientEmail, subject, html);
  await logEmail(recipientEmail, subject, "new_follower", "sent");
  return c.json({ message: "Notification sent" }, 200);
};

router.openapi(sendNewFollowerRoute, sendNewFollowerHandler);

export default router;
