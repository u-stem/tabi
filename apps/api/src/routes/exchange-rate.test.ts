import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../__tests__/test-helpers";

const { mockGetSession, mockFetchExchangeRate } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFetchExchangeRate: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../lib/exchange-rate", () => ({
  fetchExchangeRate: (...args: unknown[]) => mockFetchExchangeRate(...args),
}));

vi.mock("../lib/env", () => ({
  env: { FRONTEND_URL: "http://localhost:3000" },
}));

import { exchangeRateRoutes } from "./exchange-rate";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };
const basePath = "/api/exchange-rate";

describe("Exchange rate routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
  });

  describe(`GET ${basePath}`, () => {
    it("returns 200 with rate when params are valid", async () => {
      mockFetchExchangeRate.mockResolvedValueOnce(150.5);

      const app = createTestApp(exchangeRateRoutes, "/api/exchange-rate");
      const res = await app.request(`${basePath}?from=USD&to=JPY`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ rate: 150.5, from: "USD", to: "JPY" });
      expect(mockFetchExchangeRate).toHaveBeenCalledWith("USD", "JPY");
    });

    it("returns 400 when 'from' param is missing", async () => {
      const app = createTestApp(exchangeRateRoutes, "/api/exchange-rate");
      const res = await app.request(`${basePath}?to=JPY`);

      expect(res.status).toBe(400);
    });

    it("returns 400 when 'to' param is missing", async () => {
      const app = createTestApp(exchangeRateRoutes, "/api/exchange-rate");
      const res = await app.request(`${basePath}?from=USD`);

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid 'from' currency code", async () => {
      const app = createTestApp(exchangeRateRoutes, "/api/exchange-rate");
      const res = await app.request(`${basePath}?from=INVALID&to=JPY`);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("INVALID");
    });

    it("returns 400 for invalid 'to' currency code", async () => {
      const app = createTestApp(exchangeRateRoutes, "/api/exchange-rate");
      const res = await app.request(`${basePath}?from=USD&to=INVALID`);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toContain("INVALID");
    });

    it("returns 502 when exchange rate service is unavailable", async () => {
      mockFetchExchangeRate.mockResolvedValueOnce(null);

      const app = createTestApp(exchangeRateRoutes, "/api/exchange-rate");
      const res = await app.request(`${basePath}?from=USD&to=JPY`);
      const body = await res.json();

      expect(res.status).toBe(502);
      expect(body.error).toBeDefined();
    });

    it("returns 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const app = createTestApp(exchangeRateRoutes, "/api/exchange-rate");
      const res = await app.request(`${basePath}?from=USD&to=JPY`);

      expect(res.status).toBe(401);
    });
  });
});
