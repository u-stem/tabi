import { describe, expect, it } from "vitest";
import { generateShareToken } from "../lib/share-token";

describe("generateShareToken", () => {
  it("generates an 11-character token", () => {
    const token = generateShareToken();
    expect(token).toHaveLength(11);
  });

  it("uses only base64url characters", () => {
    const token = generateShareToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, generateShareToken));
    expect(tokens.size).toBe(100);
  });
});
