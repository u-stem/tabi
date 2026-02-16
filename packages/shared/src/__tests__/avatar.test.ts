import { describe, expect, it } from "vitest";
import {
  buildDiceBearUrl,
  DICEBEAR_STYLES,
  isValidAvatarUrl,
  updateAvatarSchema,
} from "../schemas/avatar";

describe("DICEBEAR_STYLES", () => {
  it("contains only CC0 1.0 licensed styles", () => {
    expect(DICEBEAR_STYLES).toContain("glass");
    expect(DICEBEAR_STYLES).toContain("identicon");
    expect(DICEBEAR_STYLES).toContain("pixel-art");
    expect(DICEBEAR_STYLES.length).toBe(12);
  });
});

describe("updateAvatarSchema", () => {
  it("accepts valid style and seed", () => {
    const result = updateAvatarSchema.safeParse({ style: "glass", seed: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid style", () => {
    const result = updateAvatarSchema.safeParse({ style: "adventurer", seed: "abc123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty seed", () => {
    const result = updateAvatarSchema.safeParse({ style: "glass", seed: "" });
    expect(result.success).toBe(false);
  });

  it("rejects seed longer than 36 characters", () => {
    const result = updateAvatarSchema.safeParse({
      style: "glass",
      seed: "a".repeat(37),
    });
    expect(result.success).toBe(false);
  });

  it("accepts seed with exactly 36 characters", () => {
    const result = updateAvatarSchema.safeParse({
      style: "glass",
      seed: "a".repeat(36),
    });
    expect(result.success).toBe(true);
  });
});

describe("buildDiceBearUrl", () => {
  it("builds correct URL", () => {
    const url = buildDiceBearUrl("glass", "my-seed");
    expect(url).toBe("https://api.dicebear.com/9.x/glass/svg?seed=my-seed");
  });

  it("encodes special characters in seed", () => {
    const url = buildDiceBearUrl("identicon", "hello world");
    expect(url).toBe("https://api.dicebear.com/9.x/identicon/svg?seed=hello%20world");
  });
});

describe("isValidAvatarUrl", () => {
  it("accepts a valid DiceBear URL", () => {
    expect(isValidAvatarUrl("https://api.dicebear.com/9.x/glass/svg?seed=abc123")).toBe(true);
  });

  it("accepts a URL with encoded seed", () => {
    expect(isValidAvatarUrl("https://api.dicebear.com/9.x/pixel-art/svg?seed=hello%20world")).toBe(
      true,
    );
  });

  it("rejects an arbitrary URL", () => {
    expect(isValidAvatarUrl("https://evil.com/avatar.svg")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidAvatarUrl("")).toBe(false);
  });
});
