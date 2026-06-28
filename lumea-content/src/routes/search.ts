import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { getOpenSearch } from "../lib/opensearch";
import { SearchRepository } from "../repository/search.repository";
import { SearchService } from "../services/search.service";
import { optionalAuth } from "../middleware/auth";
import { SearchResultSchema, SearchQuerySchema, ErrorResponseSchema } from "../models/content";

const app = new OpenAPIHono();

function getSearchService() {
  return new SearchService(
    new SearchRepository(
      getOpenSearch(
        process.env.OPENSEARCH_URL!,
        process.env.OPENSEARCH_USERNAME!,
        process.env.OPENSEARCH_PASSWORD!
      )
    )
  );
}

// ── GET /api/search ────────────────────────────────────────────────────────────

const searchRoute = createRoute({
  method: "get",
  path: "/api/search",
  tags: ["Search"],
  summary: "Full-text search",
  description:
    "Searches published posts via OpenSearch (BM25 + multi-field). Supports fuzzy matching, tag/category filters, and premium filter.",
  request: { query: SearchQuerySchema },
  responses: {
    200: { description: "Search results", content: { "application/json": { schema: SearchResultSchema } } },
    400: { description: "Bad query", content: { "application/json": { schema: ErrorResponseSchema } } },
  },
});

app.use("/api/search", optionalAuth);
app.openapi(searchRoute, async (c) => {
  const { q, page, limit, tags, category, premium } = c.req.valid("query");
  const viewer = c.get("user");
  const svc = getSearchService();

  const result = await svc.search(q, page, limit, viewer, { tags, category, premium });
  return c.json({ ...result, query: q });
});

// ── GET /api/search/suggest ────────────────────────────────────────────────────

const suggestRoute = createRoute({
  method: "get",
  path: "/api/search/suggest",
  tags: ["Search"],
  summary: "Search autocomplete",
  description: "Returns up to 5 title suggestions for the given prefix query.",
  request: {
    query: z.object({
      q: z.string().min(1).max(100).openapi({ example: "typescript" }),
    }),
  },
  responses: {
    200: {
      description: "Suggestions",
      content: {
        "application/json": {
          schema: z.object({ suggestions: z.array(z.string()) }).openapi("SuggestResponse"),
        },
      },
    },
  },
});

app.openapi(suggestRoute, async (c) => {
  const { q } = c.req.valid("query");
  const svc = getSearchService();
  const suggestions = await svc.suggest(q);
  return c.json({ suggestions });
});

export default app;
