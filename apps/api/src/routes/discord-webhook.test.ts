import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "../__tests__/test-helpers";

const {
  mockGetSession,
  mockDbQuery,
  mockDbInsert,
  mockDbUpdate,
  mockDbDelete,
  mockValidateWebhookUrl,
  mockSendDiscordWebhook,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: {
    tripMembers: { findFirst: vi.fn() },
    discordWebhooks: { findFirst: vi.fn() },
  },
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockValidateWebhookUrl: vi.fn(),
  mockSendDiscordWebhook: vi.fn(),
}));

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../db/index", () => ({
  db: {
    query: mockDbQuery,
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
    delete: (...args: unknown[]) => mockDbDelete(...args),
  },
}));

vi.mock("../lib/discord", () => ({
  validateWebhookUrl: (...args: unknown[]) => mockValidateWebhookUrl(...args),
  sendDiscordWebhook: (...args: unknown[]) => mockSendDiscordWebhook(...args),
}));

vi.mock("../lib/env", () => ({
  env: { FRONTEND_URL: "http://localhost:3000" },
}));

const globalMockFetch = vi.fn();
vi.stubGlobal("fetch", globalMockFetch);

import { discordWebhookRoutes } from "./discord-webhook";

const fakeUserId = "00000000-0000-0000-0000-000000000001";
const fakeUser = { id: fakeUserId, name: "Test User", email: "test@sugara.local" };
const tripId = "trip-1";
const basePath = `/api/trips/${tripId}/discord-webhook`;

const validWebhookUrl =
  "https://discord.com/api/webhooks/1234567890/abcdefghijklmnop-qrstuvwxyz_ABCDEF";

const validBody = {
  webhookUrl: validWebhookUrl,
  enabledTypes: ["member_added", "expense_added"],
  locale: "ja",
};

const fakeWebhook = {
  id: "wh-1",
  tripId,
  webhookUrl: validWebhookUrl,
  enabledTypes: ["member_added"],
  locale: "ja",
  isActive: true,
  lastSuccessAt: null,
  failureCount: 0,
  createdBy: fakeUserId,
  trip: { title: "Test Trip" },
};

describe("Discord webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      user: fakeUser,
      session: { id: "session-1" },
    });
    // Default: user is editor
    mockDbQuery.tripMembers.findFirst.mockResolvedValue({
      tripId,
      userId: fakeUserId,
      role: "editor",
    });
    mockValidateWebhookUrl.mockResolvedValue(true);
    mockSendDiscordWebhook.mockResolvedValue(undefined);
  });

  describe(`POST ${basePath}`, () => {
    it("returns 201 when creating a webhook", async () => {
      mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(undefined);
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([fakeWebhook]),
        }),
      });

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      const body = await res.json();

      expect(res.status).toBe(201);
      expect(body.id).toBe("wh-1");
      expect(body.maskedUrl).toBeDefined();
      expect(body.webhookUrl).toBeUndefined();
    });

    it("returns 400 when URL is invalid", async () => {
      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, webhookUrl: "https://example.com/not-discord" }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when webhook already exists", async () => {
      mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(fakeWebhook);

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(409);
    });

    it("returns 404 when user is viewer", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUserId,
        role: "viewer",
      });

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(404);
    });

    it("returns 400 when webhook URL is unreachable", async () => {
      mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(undefined);
      mockValidateWebhookUrl.mockResolvedValue(false);

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(400);
    });
  });

  describe(`GET ${basePath}`, () => {
    it("returns 200 with masked URL when webhook exists", async () => {
      mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(fakeWebhook);

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.maskedUrl).toBeDefined();
      expect(body.webhookUrl).toBeUndefined();
    });

    it("returns 200 with null when no webhook exists", async () => {
      mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toBeNull();
    });
  });

  describe(`DELETE ${basePath}`, () => {
    it("returns 200 on successful delete", async () => {
      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath, { method: "DELETE" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("returns 404 when user is viewer", async () => {
      mockDbQuery.tripMembers.findFirst.mockResolvedValue({
        tripId,
        userId: fakeUserId,
        role: "viewer",
      });

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(basePath, { method: "DELETE" });

      expect(res.status).toBe(404);
    });
  });

  describe(`POST ${basePath}/test`, () => {
    it("returns 200 when test notification succeeds", async () => {
      mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(fakeWebhook);
      globalMockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(`${basePath}/test`, { method: "POST" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(globalMockFetch).toHaveBeenCalledWith(
        fakeWebhook.webhookUrl,
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("returns 404 when no webhook exists", async () => {
      mockDbQuery.discordWebhooks.findFirst.mockResolvedValue(undefined);

      const app = createTestApp(discordWebhookRoutes, "/api/trips");
      const res = await app.request(`${basePath}/test`, { method: "POST" });

      expect(res.status).toBe(404);
    });
  });
});
