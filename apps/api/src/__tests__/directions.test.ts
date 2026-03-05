import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, TEST_USER } from "./test-helpers";

const {
  mockGetSession,
  mockCheckTripAccess,
  mockDbQuery,
  mockDbSelect,
  mockDbInsert,
  mockFetch,
  mockGetAppSettings,
  mockGetAdminUserId,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockCheckTripAccess: vi.fn(),
  mockDbQuery: { trips: { findFirst: vi.fn() } },
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockFetch: vi.fn(),
  mockGetAppSettings: vi.fn(),
  mockGetAdminUserId: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../lib/permissions", () => ({
  checkTripAccess: (...args: unknown[]) => mockCheckTripAccess(...args),
}));

vi.mock("../lib/app-settings", () => ({
  getAppSettings: (...args: unknown[]) => mockGetAppSettings(...args),
}));

vi.mock("../lib/resolve-is-admin", () => ({
  getAdminUserId: (...args: unknown[]) => mockGetAdminUserId(...args),
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.stubGlobal("fetch", (...args: unknown[]) => mockFetch(...args));

import { directionsRoutes } from "../routes/directions";

const BASE_URL =
  "/api/directions?tripId=trip-1&originLat=35&originLng=139&destLat=35.1&destLng=139.1";

function setupMapsEnabled() {
  mockCheckTripAccess.mockResolvedValue("viewer");
  mockGetAppSettings.mockResolvedValue({
    signupEnabled: true,
    mapsMode: "admin_only",
  });
  mockGetAdminUserId.mockResolvedValue("admin-user-id");
  mockDbQuery.trips.findFirst.mockResolvedValue({ ownerId: "admin-user-id" });
  // No cache hit by default
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
  // Insert cache (ignore)
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    }),
  });
}

describe("GET /api/directions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: TEST_USER,
      session: { id: "session-1" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(401);
  });

  it("returns 400 when required params are missing", async () => {
    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request("/api/directions?tripId=trip-1");
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a trip member", async () => {
    mockCheckTripAccess.mockResolvedValue(null);
    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(403);
  });

  it("returns 403 when global mapsMode is off", async () => {
    mockCheckTripAccess.mockResolvedValue("viewer");
    mockGetAppSettings.mockResolvedValue({
      signupEnabled: true,
      mapsMode: "off",
    });
    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(403);
  });

  it("returns 403 when mapsMode=admin_only and trip owner is not admin", async () => {
    mockCheckTripAccess.mockResolvedValue("viewer");
    mockGetAppSettings.mockResolvedValue({
      signupEnabled: true,
      mapsMode: "admin_only",
    });
    mockGetAdminUserId.mockResolvedValue("admin-user-id");
    mockDbQuery.trips.findFirst.mockResolvedValue({ ownerId: "other-user-id" });
    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(403);
  });

  it("allows request when mapsMode=public regardless of trip owner", async () => {
    mockCheckTripAccess.mockResolvedValue("viewer");
    mockGetAppSettings.mockResolvedValue({
      signupEnabled: true,
      mapsMode: "public",
    });
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    });
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        routes: [{ duration: "600s", polyline: { encodedPolyline: "xyz" } }],
      }),
    });

    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(200);
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it("returns 503 when GOOGLE_MAPS_API_KEY is not set", async () => {
    setupMapsEnabled();
    delete process.env.GOOGLE_MAPS_API_KEY;
    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(503);
  });

  it("returns durationSeconds and encodedPolyline on success", async () => {
    setupMapsEnabled();
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        routes: [{ duration: "900s", polyline: { encodedPolyline: "abc123" } }],
      }),
    });

    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ durationSeconds: 900, encodedPolyline: "abc123" });
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it("returns cached result without calling Routes API", async () => {
    setupMapsEnabled();
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi
          .fn()
          .mockResolvedValue([{ durationSeconds: 600, encodedPolyline: "cached-poly" }]),
      }),
    });

    const app = createTestApp(directionsRoutes, "/api/directions");
    const res = await app.request(BASE_URL);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ durationSeconds: 600, encodedPolyline: "cached-poly" });
    expect(mockFetch).not.toHaveBeenCalled();
    delete process.env.GOOGLE_MAPS_API_KEY;
  });

  it("stores result in cache after successful API call", async () => {
    setupMapsEnabled();
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        routes: [{ duration: "300s", polyline: { encodedPolyline: "new-poly" } }],
      }),
    });

    const app = createTestApp(directionsRoutes, "/api/directions");
    await app.request(BASE_URL);
    expect(mockDbInsert).toHaveBeenCalled();
    delete process.env.GOOGLE_MAPS_API_KEY;
  });
});
