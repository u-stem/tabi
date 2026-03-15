import { describe, expect, it } from "vitest";
import { parseQrFriendUrl } from "../qr-utils";

const ORIGIN = "https://sugara.vercel.app";

describe("parseQrFriendUrl", () => {
  it("returns userId from valid friend add URL", () => {
    const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const url = `${ORIGIN}/friends/add?userId=${userId}`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBe(userId);
  });

  it("returns null for wrong origin", () => {
    const url = "https://evil.com/friends/add?userId=a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null for wrong pathname", () => {
    const url = `${ORIGIN}/trips/add?userId=a1b2c3d4-e5f6-7890-abcd-ef1234567890`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null when userId param is missing", () => {
    const url = `${ORIGIN}/friends/add`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null for invalid UUID format", () => {
    const url = `${ORIGIN}/friends/add?userId=not-a-uuid`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBeNull();
  });

  it("returns null for non-URL text", () => {
    expect(parseQrFriendUrl("hello world", ORIGIN)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseQrFriendUrl("", ORIGIN)).toBeNull();
  });

  it("handles percent-encoded userId", () => {
    const userId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const url = `${ORIGIN}/friends/add?userId=${encodeURIComponent(userId)}`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBe(userId);
  });

  it("accepts case-insensitive UUID", () => {
    const userId = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890";
    const url = `${ORIGIN}/friends/add?userId=${userId}`;
    expect(parseQrFriendUrl(url, ORIGIN)).toBe(userId);
  });
});
