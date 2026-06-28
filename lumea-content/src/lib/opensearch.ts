import { Client } from "@opensearch-project/opensearch";

let client: Client | null = null;

export function getOpenSearch(url: string, username: string, password: string): Client {
  if (!client) {
    client = new Client({
      node: url,
      auth: { username, password },
      ssl: { rejectUnauthorized: true },
    });
  }
  return client;
}

// Index names
export const INDICES = {
  POSTS: "posts",
  ANALYTICS: "analytics",
} as const;

// OpenSearch post document shape (subset used for search)
export interface OSPostDoc {
  post_id: string;
  title: string;
  excerpt: string;
  content_text: string;
  tags: string[];
  category?: string;
  author_id: string;
  author_name: string;
  status: string;
  is_premium: boolean;
  published_at: string;
  like_count: number;
  view_count: number;
  comment_count: number;
}
