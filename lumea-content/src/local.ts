/**
 * Local dev entry point — starts a Node.js HTTP server.
 * Run with: npm run dev (uses tsx watch)
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index";

const port = parseInt(process.env.PORT ?? "8788", 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`🚀 lumea-content running on http://localhost:${info.port}`);
  console.log(`📖 Swagger UI → http://localhost:${info.port}/docs`);
});
