import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { requireAuth } from "../middleware/auth";

describe("requireAuth middleware", () => {
  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue(null);

    const app = new Hono();
    app.use("*", requireAuth);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");

    expect(res.status).toBe(401);
  });

  it("returns 401 response body with error message", async () => {
    mockGetSession.mockResolvedValue(null);

    const app = new Hono();
    app.use("*", requireAuth);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");
    const body = await res.json();

    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("passes through when session exists", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test User" },
      session: { id: "session-1" },
    });

    const app = new Hono();
    app.use("*", requireAuth);
    app.get("/protected", (c) => c.json({ ok: true }));

    const res = await app.request("/protected");

    expect(res.status).toBe(200);
  });

  it("sets user and session on context when authenticated", async () => {
    const fakeUser = { id: "user-1", name: "Test User" };
    const fakeSession = { id: "session-1" };
    mockGetSession.mockResolvedValue({ user: fakeUser, session: fakeSession });

    type Env = { Variables: { user: unknown; session: unknown } };
    const app = new Hono<Env>();
    app.use("*", requireAuth);
    app.get("/protected", (c) => {
      return c.json({
        user: c.get("user"),
        session: c.get("session"),
      });
    });

    const res = await app.request("/protected");
    const body = await res.json();

    expect(body).toEqual({ user: fakeUser, session: fakeSession });
  });
});
