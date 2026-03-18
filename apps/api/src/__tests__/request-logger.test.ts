import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../lib/logger";
import { requestLogger } from "../middleware/request-logger";

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("requestLogger middleware", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("logs info for successful requests", async () => {
    const app = new Hono();
    app.use("*", requestLogger());
    app.get("/api/test", (c) => c.json({ ok: true }));

    await app.request("/api/test");

    expect(logger.info).toHaveBeenCalledOnce();
    const logged = vi.mocked(logger.info).mock.calls[0][0] as Record<string, unknown>;
    expect(logged).toMatchObject({
      method: "GET",
      path: "/api/test",
      status: 200,
    });
    expect(logged.requestId).toBeTypeOf("string");
    expect(logged.duration).toBeTypeOf("number");
  });

  it("logs warn for 4xx responses", async () => {
    const app = new Hono();
    app.use("*", requestLogger());
    app.get("/api/bad", (c) => c.json({ error: "bad" }, 400));

    await app.request("/api/bad");

    expect(logger.warn).toHaveBeenCalledOnce();
    const logged = vi.mocked(logger.warn).mock.calls[0][0] as Record<string, unknown>;
    expect(logged.status).toBe(400);
  });

  it("logs error for 5xx responses", async () => {
    const app = new Hono();
    app.use("*", requestLogger());
    app.get("/api/fail", (c) => c.json({ error: "fail" }, 500));

    await app.request("/api/fail");

    expect(logger.error).toHaveBeenCalledOnce();
    const logged = vi.mocked(logger.error).mock.calls[0][0] as Record<string, unknown>;
    expect(logged.status).toBe(500);
  });

  it("skips /health requests", async () => {
    const app = new Hono();
    app.use("*", requestLogger());
    app.get("/health", (c) => c.json({ status: "ok" }));

    await app.request("/health");

    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("sets requestId on context", async () => {
    let capturedRequestId: string | undefined;
    const app = new Hono<{ Variables: { requestId: string } }>();
    app.use("*", requestLogger());
    app.get("/api/check", (c) => {
      capturedRequestId = c.get("requestId");
      return c.json({ ok: true });
    });

    await app.request("/api/check");

    expect(capturedRequestId).toBeTypeOf("string");
    expect(capturedRequestId).toMatch(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/);
  });
});
