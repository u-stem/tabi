import { describe, expect, it } from "vitest";
import { extractTitle, titleFromUrl } from "./ogp";

describe("extractTitle", () => {
  it("extracts og:title from HTML", () => {
    const html = '<html><head><meta property="og:title" content="My Page Title" /></head></html>';
    expect(extractTitle(html)).toBe("My Page Title");
  });

  it("falls back to title tag when og:title is missing", () => {
    const html = "<html><head><title>Fallback Title</title></head></html>";
    expect(extractTitle(html)).toBe("Fallback Title");
  });

  it("returns null when no title is found", () => {
    const html = "<html><head></head><body>Hello</body></html>";
    expect(extractTitle(html)).toBeNull();
  });

  it("decodes HTML entities in extracted title", () => {
    const html =
      '<html><head><meta property="og:title" content="Title &amp; More" /></head></html>';
    expect(extractTitle(html)).toBe("Title & More");
  });

  it("handles single-quoted og:title attribute", () => {
    const html = "<html><head><meta property='og:title' content='Single Quoted' /></head></html>";
    expect(extractTitle(html)).toBe("Single Quoted");
  });

  it("prefers og:title over title tag", () => {
    const html =
      '<html><head><meta property="og:title" content="OG Title" /><title>Title Tag</title></head></html>';
    expect(extractTitle(html)).toBe("OG Title");
  });

  it("handles content attribute before property attribute", () => {
    const html = '<html><head><meta content="Reversed Order" property="og:title" /></head></html>';
    expect(extractTitle(html)).toBe("Reversed Order");
  });
});

describe("titleFromUrl", () => {
  it("generates title from URL domain and path", () => {
    expect(titleFromUrl("https://example.com/path/to/page")).toBe("example.com/path/to/page");
  });

  it("removes trailing slash", () => {
    expect(titleFromUrl("https://example.com/")).toBe("example.com");
  });

  it("strips query params", () => {
    expect(titleFromUrl("https://example.com/search?q=test")).toBe("example.com/search");
  });
});
