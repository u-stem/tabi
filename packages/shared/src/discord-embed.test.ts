import { describe, expect, it } from "vitest";
import { buildDiscordEmbed, DISCORD_EMBED_COLORS } from "./discord-embed";

describe("buildDiscordEmbed", () => {
  it("builds embed for member_added", () => {
    const embed = buildDiscordEmbed({
      type: "member_added",
      payload: { actorName: "Tanaka", tripName: "Tokyo Trip" },
      tripId: "trip-1",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });
    expect(embed.color).toBe(DISCORD_EMBED_COLORS.member);
    expect(embed.author?.name).toBe("sugara");
    expect(embed.title).toBe("Tokyo Trip");
    expect(embed.description).toContain("Tanaka");
    expect(embed.url).toBe("https://sugara.vercel.app/trips/trip-1");
    expect(embed.timestamp).toBeDefined();
  });

  it("builds embed for schedule_created", () => {
    const embed = buildDiscordEmbed({
      type: "schedule_created",
      payload: { actorName: "Suzuki", tripName: "Osaka Trip", entityName: "Universal Studios" },
      tripId: "trip-2",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });
    expect(embed.color).toBe(DISCORD_EMBED_COLORS.schedule);
    expect(embed.description).toContain("Suzuki");
    expect(embed.description).toContain("Universal Studios");
  });

  it("builds embed with English locale", () => {
    const embed = buildDiscordEmbed({
      type: "member_added",
      payload: { actorName: "Tanaka", tripName: "Tokyo Trip" },
      tripId: "trip-1",
      locale: "en",
      baseUrl: "https://sugara.vercel.app",
    });
    expect(embed.description).toContain("Tanaka");
  });

  it("builds embed for expense_added", () => {
    const embed = buildDiscordEmbed({
      type: "expense_added",
      payload: { actorName: "Yamada", tripName: "Kyoto Trip", entityName: "Dinner" },
      tripId: "trip-3",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });
    expect(embed.color).toBe(DISCORD_EMBED_COLORS.expense);
  });

  it("builds embed for poll_started", () => {
    const embed = buildDiscordEmbed({
      type: "poll_started",
      payload: { tripName: "Summer Trip" },
      tripId: "trip-4",
      locale: "ja",
      baseUrl: "https://sugara.vercel.app",
    });
    expect(embed.color).toBe(DISCORD_EMBED_COLORS.poll);
  });

  it("falls back to English for unknown locale", () => {
    const embed = buildDiscordEmbed({
      type: "member_added",
      payload: { actorName: "Tanaka", tripName: "Trip" },
      tripId: "trip-1",
      locale: "fr",
      baseUrl: "https://sugara.vercel.app",
    });
    expect(embed.description).toContain("Tanaka");
  });
});

describe("DISCORD_EMBED_COLORS", () => {
  it("has all four categories", () => {
    expect(DISCORD_EMBED_COLORS).toHaveProperty("member");
    expect(DISCORD_EMBED_COLORS).toHaveProperty("schedule");
    expect(DISCORD_EMBED_COLORS).toHaveProperty("poll");
    expect(DISCORD_EMBED_COLORS).toHaveProperty("expense");
  });
});
