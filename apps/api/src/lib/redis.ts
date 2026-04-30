import { Redis } from "@upstash/redis";
import { env } from "./env";

let cached: Redis | null | undefined;

/**
 * Returns the shared Upstash Redis client, or null when env vars are not set.
 * Local dev / tests can omit credentials and the rate limit middleware will
 * fall back to an in-memory store (best-effort, per-instance).
 */
export function getRedis(): Redis | null {
  if (cached !== undefined) return cached;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    cached = null;
    return null;
  }
  cached = new Redis({ url, token });
  return cached;
}

/**
 * Reset the cached client. Tests stub env vars via process.env and need
 * the next getRedis() call to re-evaluate.
 */
export function resetRedisCache(): void {
  cached = undefined;
}

/**
 * Better Auth secondaryStorage backed by Upstash Redis. Returns null when
 * Redis is not configured so the auth setup can fall back to memory storage.
 */
export function createUpstashSecondaryStorage() {
  const redis = getRedis();
  if (!redis) return undefined;

  return {
    get: async (key: string) => {
      const value = await redis.get<string>(key);
      return value ?? null;
    },
    set: async (key: string, value: string, ttl?: number) => {
      if (ttl) {
        await redis.set(key, value, { ex: ttl });
      } else {
        await redis.set(key, value);
      }
    },
    delete: async (key: string) => {
      await redis.del(key);
    },
  };
}
