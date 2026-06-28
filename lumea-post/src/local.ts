import { serve } from "@hono/node-server";
import app from "./index";

serve({ fetch: app.fetch, port: 8787 }, (info) => {
  console.log(`[lumea-post] Local server running at http://localhost:${info.port}`);
  console.log(`[lumea-post] Swagger UI: http://localhost:${info.port}/docs`);
});
