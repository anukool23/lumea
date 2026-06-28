import { MongoClient, Db } from "mongodb";

let cachedClient: MongoClient | null = null;

/**
 * Returns a cached MongoDB client for the Worker instance.
 * CF Workers reuse the same isolate across requests on the same edge node,
 * so this avoids reconnecting on every request.
 */
export async function getMongoClient(uri: string): Promise<MongoClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    minPoolSize: 1,
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  cachedClient = client;
  return client;
}

export async function getDb(uri: string): Promise<Db> {
  const client = await getMongoClient(uri);
  return client.db("lumea");
}

// Collection names
export const COLLECTIONS = {
  POSTS: "posts",
  MEDIA_METADATA: "media_metadata",
} as const;
