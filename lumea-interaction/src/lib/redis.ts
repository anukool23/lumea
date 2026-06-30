import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }
  return _redis;
}

export const RedisKeys = {
  jwtBlacklist: (jti: string) => `bl:${jti}`,
  viewDedup:    (postId: string, id: string) => `view:${postId}:${id}`,
} as const;
