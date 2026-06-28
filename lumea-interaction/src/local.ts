import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index";
serve({ fetch: app.fetch, port: 8790 }, (i) => {
  console.log(`🚀 lumea-interaction on http://localhost:${i.port}`);
  console.log(`📖 Swagger → http://localhost:${i.port}/docs`);
});
