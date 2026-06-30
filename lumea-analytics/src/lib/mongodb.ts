import { MongoClient, type Db } from "mongodb";

let _client: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (!_client) {
    _client = new MongoClient(process.env.MONGODB_URI!, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
    await _client.connect();
  }
  return _client.db("lumea");
}

export const COLLECTIONS = {
  POSTS: "posts",
} as const;
