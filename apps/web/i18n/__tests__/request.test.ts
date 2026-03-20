import { describe, expect, it } from "vitest";
import { resolveLocale } from "../request";

describe("resolveLocale", () => {
  it("returns cookie locale when set to supported value", () => {
    expect(resolveLocale("en", "ja")).toBe("en");
  });

  it("ignores cookie when set to unsupported value", () => {
    expect(resolveLocale("fr", "en-US,ja;q=0.9")).toBe("en");
  });

  it("returns Accept-Language primary language when no cookie", () => {
    expect(resolveLocale(undefined, "en-US,ja;q=0.9")).toBe("en");
  });

  it("returns ja from Accept-Language header", () => {
    expect(resolveLocale(undefined, "ja,en;q=0.9")).toBe("ja");
  });

  it("falls back to ja when Accept-Language is unsupported", () => {
    expect(resolveLocale(undefined, "fr-FR,de;q=0.9")).toBe("ja");
  });

  it("falls back to ja when both cookie and Accept-Language are empty", () => {
    expect(resolveLocale(undefined, "")).toBe("ja");
  });
});
