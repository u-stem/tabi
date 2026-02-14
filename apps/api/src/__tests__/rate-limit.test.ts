import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimitByIp } from "../middleware/rate-limit";

describe("rateLimitByIp middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within the limit", async () => {
    const app = new Hono();
    app.use("*", rateLimitByIp({ window: 60, max: 3 }));
    app.get("/test", (c) => c.json({ ok: true }));

    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });

    expect(res.status).toBe(200);
  });

  it("returns 429 when exceeding the limit", async () => {
    const app = new Hono();
    app.use("*", rateLimitByIp({ window: 60, max: 2 }));
    app.get("/test", (c) => c.json({ ok: true }));

    const headers = { "x-forwarded-for": "1.2.3.4" };

    await app.request("/test", { headers });
    await app.request("/test", { headers });
    const res = await app.request("/test", { headers });

    expect(res.status).toBe(429);
  });

  it("returns error body on 429", async () => {
    const app = new Hono();
    app.use("*", rateLimitByIp({ window: 60, max: 1 }));
    app.get("/test", (c) => c.json({ ok: true }));

    const headers = { "x-forwarded-for": "1.2.3.4" };

    await app.request("/test", { headers });
    const res = await app.request("/test", { headers });
    const body = await res.json();

    expect(body).toEqual({ error: "Too many requests" });
  });

  it("resets after the window expires", async () => {
    const app = new Hono();
    app.use("*", rateLimitByIp({ window: 60, max: 1 }));
    app.get("/test", (c) => c.json({ ok: true }));

    const headers = { "x-forwarded-for": "1.2.3.4" };

    await app.request("/test", { headers });
    const blocked = await app.request("/test", { headers });
    expect(blocked.status).toBe(429);

    vi.advanceTimersByTime(60_000);

    const res = await app.request("/test", { headers });
    expect(res.status).toBe(200);
  });

  it("tracks IPs independently", async () => {
    const app = new Hono();
    app.use("*", rateLimitByIp({ window: 60, max: 1 }));
    app.get("/test", (c) => c.json({ ok: true }));

    await app.request("/test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    const res = await app.request("/test", {
      headers: { "x-forwarded-for": "2.2.2.2" },
    });

    expect(res.status).toBe(200);
  });
});
