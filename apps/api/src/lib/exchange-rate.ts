import { logger } from "./logger";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { rate: number; fetchedAt: number }>();

export async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  const key = `${from}-${to}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data.rates?.[to];
    if (typeof rate !== "number") return null;
    cache.set(key, { rate, fetchedAt: Date.now() });
    return rate;
  } catch (err) {
    logger.error({ err, from, to }, "Failed to fetch exchange rate");
    return null;
  }
}

// For testing: clear cache
export function clearExchangeRateCache(): void {
  cache.clear();
}
