import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("./logger", () => ({
  logger: { error: vi.fn() },
}));

import { clearExchangeRateCache, fetchExchangeRate } from "./exchange-rate";

describe("fetchExchangeRate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearExchangeRateCache();
  });

  it("returns rate on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { JPY: 150.5 } }),
    });

    const rate = await fetchExchangeRate("USD", "JPY");

    expect(rate).toBe(150.5);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v1/latest?from=USD&to=JPY",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns cached rate on second call without fetching again", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rates: { JPY: 150.5 } }),
    });

    const first = await fetchExchangeRate("USD", "JPY");
    const second = await fetchExchangeRate("USD", "JPY");

    expect(first).toBe(150.5);
    expect(second).toBe(150.5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns null on non-ok API response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });

    const rate = await fetchExchangeRate("USD", "JPY");

    expect(rate).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const rate = await fetchExchangeRate("USD", "JPY");

    expect(rate).toBeNull();
  });

  it("fetches again after cache TTL expires", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { JPY: 150.5 } }),
    });

    try {
      await fetchExchangeRate("EUR", "JPY");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time beyond 1 hour so the cache entry is stale
      const future = Date.now() + 61 * 60 * 1000;
      vi.spyOn(Date, "now").mockReturnValue(future);

      await fetchExchangeRate("EUR", "JPY");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.spyOn(Date, "now").mockRestore();
    }
  });
});
