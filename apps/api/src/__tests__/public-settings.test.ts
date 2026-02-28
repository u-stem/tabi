import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAppSettings = vi.fn();

vi.mock("../lib/app-settings", () => ({
  getAppSettings: (...args: unknown[]) => mockGetAppSettings(...args),
}));

import { publicSettingsRoutes } from "../routes/public-settings";

function createApp() {
  const app = new Hono();
  app.route("/", publicSettingsRoutes);
  return app;
}

describe("GET /api/public/settings", () => {
  const app = createApp();

  beforeEach(() => {
    mockGetAppSettings.mockResolvedValue({ signupEnabled: true });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns signupEnabled: true when signup is open", async () => {
    const res = await app.request("/api/public/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: true });
  });

  it("returns signupEnabled: false when signup is disabled", async () => {
    mockGetAppSettings.mockResolvedValue({ signupEnabled: false });
    const res = await app.request("/api/public/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: false });
  });
});
