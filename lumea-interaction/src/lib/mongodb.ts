import { MongoClient, Db } from "mongodb";

export const COLLECTIONS = {
  LIKES:     "likes",
  COMMENTS:  "comments",
  BOOKMARKS: "bookmarks",
  POSTS:     "posts",   // shared with lumea-post for counter updates
} as const;

let _client: MongoClient | null = null;

export async function getDb(uri: string): Promise<Db> {
  if (!_client) {
    _client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
    await _client.connect();
  }
  return _client.db("lumea");
}
