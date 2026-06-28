import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(url: string, token: string): Redis {
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

export const CacheKeys = {
  /** JWT blacklist — bl:{jti} */
  jwtBlacklist: (jti: string) => `bl:${jti}`,
  /** Following set — following:{userId} → Set<followingId> (5 min TTL) */
  following: (userId: string) => `following:${userId}`,
  /** Trending feed — trending (10 min TTL) */
  trending: () => `feed:trending`,
  /** Explore feed by tag — explore:tag:{tag} */
  exploreTag: (tag: string) => `explore:tag:${tag}`,
} as const;

export const TTL = {
  FOLLOWING: 300,   // 5 min
  TRENDING: 600,    // 10 min
  EXPLORE: 120,     // 2 min
} as const;
