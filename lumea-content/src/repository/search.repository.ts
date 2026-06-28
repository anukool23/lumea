import { Client } from "@opensearch-project/opensearch";
import { INDICES, OSPostDoc } from "../lib/opensearch";

export interface SearchOptions {
  query: string;
  tags?: string[];
  category?: string;
  premium?: "all" | "free" | "premium";
  page: number;
  limit: number;
}

export interface SearchResult {
  hits: OSPostDoc[];
  total: number;
  took: number;
}

export class SearchRepository {
  constructor(private client: Client) {}

  async search(opts: SearchOptions): Promise<SearchResult> {
    const from = (opts.page - 1) * opts.limit;

    // Build filter clauses
    const filterClauses: object[] = [{ term: { status: "PUBLISHED" } }];

    if (opts.category) {
      filterClauses.push({ term: { category: opts.category } });
    }
    if (opts.tags && opts.tags.length > 0) {
      filterClauses.push({ terms: { tags: opts.tags } });
    }
    if (opts.premium === "free") {
      filterClauses.push({ term: { is_premium: false } });
    } else if (opts.premium === "premium") {
      filterClauses.push({ term: { is_premium: true } });
    }

    const body = {
      from,
      size: opts.limit,
      query: {
        bool: {
          must: {
            multi_match: {
              query: opts.query,
              fields: ["title^3", "excerpt^2", "content_text", "tags^2", "author_name"],
              type: "best_fields",
              fuzziness: "AUTO",
            },
          },
          filter: filterClauses,
        },
      },
      highlight: {
        fields: {
          title: {},
          excerpt: {},
        },
        pre_tags: ["<mark>"],
        post_tags: ["</mark>"],
      },
      sort: [
        { _score: { order: "desc" } },
        { published_at: { order: "desc" } },
      ],
    };

    const response = await this.client.search({ index: INDICES.POSTS, body });

    const hits = response.body.hits.hits.map(
      (h: { _source: OSPostDoc }) => h._source
    );
    const total =
      typeof response.body.hits.total === "number"
        ? response.body.hits.total
        : response.body.hits.total.value;

    return {
      hits,
      total,
      took: response.body.took,
    };
  }

  async suggest(query: string, limit = 5): Promise<string[]> {
    const body = {
      size: 0,
      suggest: {
        title_suggest: {
          prefix: query,
          completion: {
            field: "title.suggest",
            size: limit,
            skip_duplicates: true,
          },
        },
      },
    };

    try {
      const response = await this.client.search({ index: INDICES.POSTS, body });
      const options =
        response.body.suggest?.title_suggest?.[0]?.options ?? [];
      return options.map((o: { text: string }) => o.text);
    } catch {
      return [];
    }
  }
}
