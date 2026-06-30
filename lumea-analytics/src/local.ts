import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./index";

const port = Number(process.env.PORT ?? 8792);

serve({ fetch: app.fetch, port }, (i) => {
  console.log(`lumea-analytics running on http://localhost:${i.port}`);
  console.log(`Swagger UI → http://localhost:${i.port}/docs`);
});
