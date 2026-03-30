import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../__tests__/test-helpers";

const { mockGetSession, mockFetchOgpTitle } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFetchOgpTitle: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../lib/ogp", () => ({
  fetchOgpTitle: (...args: unknown[]) => mockFetchOgpTitle(...args),
}));

vi.mock("../lib/env", () => ({
  env: { FRONTEND_URL: "http://localhost:3000" },
}));

import { ogpRoutes } from "./ogp";

const fakeUser = { id: "user-1", name: "Test User", email: "test@example.com" };
const basePath = "/api/ogp";

describe("OGP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
  });

  describe(`GET ${basePath}`, () => {
    it("returns title for valid HTTPS URL", async () => {
      mockFetchOgpTitle.mockResolvedValueOnce("Example Page");

      const app = createTestApp(ogpRoutes, "/api");
      const res = await app.request(`${basePath}?url=${encodeURIComponent("https://example.com")}`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ title: "Example Page" });
      expect(mockFetchOgpTitle).toHaveBeenCalledWith("https://example.com");
    });

    it("returns 400 for missing url parameter", async () => {
      const app = createTestApp(ogpRoutes, "/api");
      const res = await app.request(basePath);

      expect(res.status).toBe(400);
    });

    it("returns 400 for non-HTTPS URL", async () => {
      const app = createTestApp(ogpRoutes, "/api");
      const res = await app.request(`${basePath}?url=${encodeURIComponent("http://example.com")}`);

      expect(res.status).toBe(400);
    });

    it("returns 400 for invalid URL", async () => {
      const app = createTestApp(ogpRoutes, "/api");
      const res = await app.request(`${basePath}?url=${encodeURIComponent("not-a-url")}`);

      expect(res.status).toBe(400);
    });

    it("returns 401 when not authenticated", async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const app = createTestApp(ogpRoutes, "/api");
      const res = await app.request(`${basePath}?url=${encodeURIComponent("https://example.com")}`);

      expect(res.status).toBe(401);
    });
  });
});
