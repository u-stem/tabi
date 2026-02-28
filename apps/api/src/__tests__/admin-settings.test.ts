import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, TEST_USER } from "./test-helpers";

const mockGetSession = vi.fn();
const mockGetAppSettings = vi.fn();
const mockDbUpdate = vi.fn();
const mockDbSelect = vi.fn();

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../lib/app-settings", () => ({
  getAppSettings: (...args: unknown[]) => mockGetAppSettings(...args),
}));

vi.mock("../db/index", () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

import { adminRoutes } from "../routes/admin";

const ADMIN_USER = {
  ...TEST_USER,
  username: "adminuser",
  isAnonymous: false,
  guestExpiresAt: null,
};

function createApp() {
  return createTestApp(adminRoutes, "/");
}

describe("GET /api/admin/settings", () => {
  const app = createApp();

  beforeEach(() => {
    process.env.ADMIN_USERNAME = "adminuser";
    mockGetAppSettings.mockResolvedValue({ signupEnabled: true });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/api/admin/settings");
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockGetSession.mockResolvedValue({
      user: { ...ADMIN_USER, username: "notadmin" },
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings");
    expect(res.status).toBe(403);
  });

  it("returns signupEnabled: true when signup is open", async () => {
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: true });
  });

  it("returns signupEnabled: false when signup is disabled", async () => {
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    mockGetAppSettings.mockResolvedValue({ signupEnabled: false });
    const res = await app.request("/api/admin/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: false });
  });
});

describe("PATCH /api/admin/settings", () => {
  const app = createApp();

  beforeEach(() => {
    process.env.ADMIN_USERNAME = "adminuser";
    // Chain: db.update(table).set(values).where(cond) → resolves void
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ signupEnabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for non-boolean signupEnabled", async () => {
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ signupEnabled: "yes" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("updates setting and returns new value", async () => {
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ signupEnabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: false });
    expect(mockDbUpdate).toHaveBeenCalledOnce();
  });
});
