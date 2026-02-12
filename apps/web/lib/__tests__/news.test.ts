import { describe, expect, it } from "vitest";
import { getAllNews, getNewsBySlug } from "../news";

describe("getAllNews", () => {
  it("returns articles sorted by date descending", async () => {
    const articles = await getAllNews();

    expect(articles.length).toBeGreaterThan(0);

    for (let i = 1; i < articles.length; i++) {
      expect(articles[i - 1].date >= articles[i].date).toBe(true);
    }
  });

  it("returns metadata fields for each article", async () => {
    const articles = await getAllNews();
    const article = articles[0];

    expect(article).toHaveProperty("title");
    expect(article).toHaveProperty("date");
    expect(article).toHaveProperty("summary");
    expect(article).toHaveProperty("slug");
  });
});

describe("getNewsBySlug", () => {
  it("returns article with metadata and markdown content", async () => {
    const article = await getNewsBySlug("2026-02-12-launch");

    expect(article).not.toBeNull();
    expect(article!.title).toBe("sugara をリリースしました");
    expect(article!.date).toBe("2026-02-12");
    expect(article!.content).toContain("## 主な機能");
  });

  it("returns null for non-existent slug", async () => {
    const article = await getNewsBySlug("non-existent-article");

    expect(article).toBeNull();
  });
});
