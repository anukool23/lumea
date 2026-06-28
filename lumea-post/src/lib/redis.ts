import { Redis } from "@upstash/redis";

let cachedRedis: Redis | null = null;

export function getRedis(): Redis {
  if (!cachedRedis) {
    cachedRedis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }
  return cachedRedis;
}

export const RedisKeys = {
  jwtBlacklist: (jti: string) => `bl:${jti}`,
  feedCache: (userId: string) => `feed:${userId}`,
  draftAutosave: (postId: string) => `draft:${postId}`,
} as const;
