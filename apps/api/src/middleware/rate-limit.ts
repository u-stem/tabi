import type { Context, Next } from "hono";
import { ERROR_MSG } from "../lib/constants";

type RateLimitEntry = { count: number; resetAt: number };

// In-memory store. In Vercel's serverless environment each function instance
// has its own memory, so this store is not shared across instances.
// The rate limit is therefore best-effort and not a hard guarantee.
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
    // Prefer x-real-ip (Vercel sets it from the upstream edge, not spoofable by clients).
    // Fall back to the *last* entry of x-forwarded-for — the rightmost hop is the one added
    // by the trusted proxy, so taking the leftmost lets clients spoof the source IP.
    const ip =
      c.req.header("x-real-ip")?.trim() ||
      c.req.header("x-forwarded-for")?.split(",").at(-1)?.trim() ||
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
