import { Client } from "@opensearch-project/opensearch";

let _client: Client | null = null;

export function getOS(): Client {
  if (!_client) {
    _client = new Client({
      node: process.env.OPENSEARCH_URL!,
      auth: {
        username: process.env.OPENSEARCH_USERNAME!,
        password: process.env.OPENSEARCH_PASSWORD!,
      },
      ssl: { rejectUnauthorized: false },
    });
  }
  return _client;
}

export const INDICES = {
  ANALYTICS: "lumea-analytics",
} as const;

// Map period string to OpenSearch range value
export const PERIOD_MAP: Record<string, string> = {
  "7d":  "now-7d/d",
  "30d": "now-30d/d",
  "90d": "now-90d/d",
  "all": "2020-01-01",
};
