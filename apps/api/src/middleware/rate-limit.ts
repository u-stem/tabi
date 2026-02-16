import type { Context, Next } from "hono";
import { ERROR_MSG } from "../lib/constants";

type RateLimitEntry = { count: number; resetAt: number };

// Shared store cache keyed by "window:max" to prevent duplicate setIntervals
const storeCache = new Map<string, Map<string, RateLimitEntry>>();

export function rateLimitByIp(opts: { window: number; max: number }) {
  const cacheKey = `${opts.window}:${opts.max}`;
  let store = storeCache.get(cacheKey);

  if (!store) {
    store = new Map<string, RateLimitEntry>();
    storeCache.set(cacheKey, store);

    // Evict expired entries to prevent unbounded memory growth
    const storeRef = store;
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of storeRef) {
        if (entry.resetAt <= now) storeRef.delete(key);
      }
    }, opts.window * 1000).unref();
  }

  const storeRef = store;

  return async (c: Context, next: Next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";
    const now = Date.now();
    const entry = storeRef.get(ip);

    if (!entry || entry.resetAt <= now) {
      storeRef.set(ip, { count: 1, resetAt: now + opts.window * 1000 });
      return next();
    }

    entry.count++;
    if (entry.count > opts.max) {
      return c.json({ error: ERROR_MSG.TOO_MANY_REQUESTS }, 429);
    }
    return next();
  };
}
