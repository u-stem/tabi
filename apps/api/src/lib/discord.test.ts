import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { mockDbUpdate, mockDbQueryDiscordWebhooks } = vi.hoisted(() => ({
  mockDbUpdate: vi.fn(),
  mockDbQueryDiscordWebhooks: { findFirst: vi.fn() },
}));

vi.mock("../db/index", () => ({
  db: {
    update: (...args: unknown[]) => mockDbUpdate(...args),
    query: { discordWebhooks: mockDbQueryDiscordWebhooks },
  },
}));

vi.mock("./logger", () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("./notifications", () => ({
  notifyUsers: vi.fn(),
}));

import { sendDiscordWebhook, validateWebhookUrl } from "./discord";

const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

describe("validateWebhookUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for valid webhook URL", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await validateWebhookUrl("https://discord.com/api/webhooks/123/abc");
    expect(result).toBe(true);
  });

  it("returns false for invalid webhook URL", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await validateWebhookUrl("https://discord.com/api/webhooks/invalid/invalid");
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const result = await validateWebhookUrl("https://discord.com/api/webhooks/123/abc");
    expect(result).toBe(false);
  });
});

describe("sendDiscordWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([]);
    mockWhere.mockReturnValue({ returning: mockReturning });
    mockSet.mockReturnValue({ where: mockWhere });
    mockDbUpdate.mockReturnValue({ set: mockSet });
  });

  it("sends embed and updates lastSuccessAt on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123/abc",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("deactivates webhook on 404 response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    mockDbQueryDiscordWebhooks.findFirst.mockResolvedValue({
      tripId: "trip-1",
      createdBy: "user-1",
    });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("deactivates webhook on 401 response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    mockDbQueryDiscordWebhooks.findFirst.mockResolvedValue({
      tripId: "trip-1",
      createdBy: "user-1",
    });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("retries once on 5xx then increments failureCount", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("succeeds on retry after initial 5xx", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 204 });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("increments failureCount on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    expect(mockDbUpdate).toHaveBeenCalled();
  });

  it("deactivates webhook when failureCount reaches threshold", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    mockReturning.mockResolvedValue([{ failureCount: 5 }]);
    mockDbQueryDiscordWebhooks.findFirst.mockResolvedValue({
      tripId: "trip-1",
      createdBy: "user-1",
    });

    await sendDiscordWebhook({
      webhookId: "wh-1",
      webhookUrl: "https://discord.com/api/webhooks/123/abc",
      embed: { title: "Test", description: "Test", url: "", color: 0, timestamp: "" },
    });

    // Called twice: once for incrementFailureCount, once for deactivateWebhook
    expect(mockDbUpdate).toHaveBeenCalledTimes(2);
  });
});
