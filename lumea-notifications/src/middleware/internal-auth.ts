import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";

export function checkInternalToken(c: Context): void {
  const token = c.req.header("X-Internal-Token");
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected || token !== expected) {
    throw new HTTPException(403, { message: "Invalid or missing internal token" });
  }
}
