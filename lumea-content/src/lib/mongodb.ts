import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;

export async function getDb(uri: string): Promise<Db> {
  if (!client) {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      connectTimeoutMS: 5000,
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
  }
  return client.db("lumea");
}

export const COLLECTIONS = {
  POSTS: "posts",
} as const;
