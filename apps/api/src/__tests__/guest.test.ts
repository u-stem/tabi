import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import { requireNonGuest } from "../middleware/require-non-guest";

const guestUser = {
  id: "guest-1",
  name: "Guest User",
  email: "anon_abc@guest.sugara.local",
  isAnonymous: true,
  guestExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const normalUser = {
  id: "user-1",
  name: "Normal User",
  email: "user@example.com",
  isAnonymous: false,
};

describe("requireNonGuest middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for guest user", async () => {
    mockGetSession.mockResolvedValue({
      user: guestUser,
      session: { id: "session-1" },
    });

    const app = new Hono();
    app.use("*", requireAuth);
    app.use("*", requireNonGuest);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: ERROR_MSG.GUEST_NOT_ALLOWED });
  });

  it("passes through for normal user", async () => {
    mockGetSession.mockResolvedValue({
      user: normalUser,
      session: { id: "session-1" },
    });

    const app = new Hono();
    app.use("*", requireAuth);
    app.use("*", requireNonGuest);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");

    expect(res.status).toBe(200);
  });
});

describe("requireAuth with expired guest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when guest account has expired", async () => {
    const expiredGuest = {
      ...guestUser,
      guestExpiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    mockGetSession.mockResolvedValue({
      user: expiredGuest,
      session: { id: "session-1" },
    });

    const app = new Hono();
    app.use("*", requireAuth);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: ERROR_MSG.GUEST_EXPIRED });
  });

  it("passes through when guest account is not expired", async () => {
    mockGetSession.mockResolvedValue({
      user: guestUser,
      session: { id: "session-1" },
    });

    const app = new Hono();
    app.use("*", requireAuth);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");

    expect(res.status).toBe(200);
  });
});
