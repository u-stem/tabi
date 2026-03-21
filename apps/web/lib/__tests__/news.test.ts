import { describe, expect, it } from "vitest";
import { getAllNews, getNewsBySlug } from "../news";

describe("getAllNews", () => {
  it("returns articles sorted by date descending", () => {
    const articles = getAllNews("ja");

    expect(articles.length).toBeGreaterThan(0);

    for (let i = 1; i < articles.length; i++) {
      expect(articles[i - 1].date >= articles[i].date).toBe(true);
    }
  });

  it("returns metadata fields for each article", () => {
    const articles = getAllNews("ja");
    const article = articles[0];

    expect(article).toHaveProperty("title");
    expect(article).toHaveProperty("date");
    expect(article).toHaveProperty("summary");
    expect(article).toHaveProperty("slug");
  });

  it("returns same number of articles for en as ja", () => {
    const jaArticles = getAllNews("ja");
    const enArticles = getAllNews("en");

    expect(enArticles.length).toBe(jaArticles.length);
  });
});

describe("getNewsBySlug", () => {
  it("returns article with metadata and markdown content", () => {
    const article = getNewsBySlug("2026-02-12-launch", "ja");

    expect(article).not.toBeNull();
    if (!article) throw new Error("article not found");
    expect(article.title).toBe("sugara をリリースしました");
    expect(article.date).toBe("2026-02-12");
    expect(article.content).toContain("## 主な機能");
  });

  it("returns null for non-existent slug", () => {
    const article = getNewsBySlug("non-existent-article", "ja");

    expect(article).toBeNull();
  });

  it("falls back to ja for unknown locale", () => {
    const jaArticle = getNewsBySlug("2026-02-12-launch", "ja");
    const frArticle = getNewsBySlug("2026-02-12-launch", "fr");

    expect(frArticle).not.toBeNull();
    expect(frArticle?.title).toBe(jaArticle?.title);
  });

  it("returns en article when it exists", () => {
    const enArticle = getNewsBySlug("2026-03-21-i18n", "en");

    expect(enArticle).not.toBeNull();
    if (!enArticle) throw new Error("article not found");
    expect(enArticle.title).toBe("English language support added");
  });
});
