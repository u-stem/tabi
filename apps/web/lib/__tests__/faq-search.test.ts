import { describe, expect, it } from "vitest";
import { buildFaqIndex, createBigramTokenizer } from "../faq-search";

describe("createBigramTokenizer", () => {
  it("returns bigrams for Japanese text", () => {
    expect(createBigramTokenizer("メンバー")).toEqual(["メン", "ンバ", "バー"]);
  });

  it("returns single char for 1-char input", () => {
    expect(createBigramTokenizer("A")).toEqual(["a"]);
  });

  it("returns empty array for empty string", () => {
    expect(createBigramTokenizer("")).toEqual([]);
  });

  it("ignores whitespace between characters", () => {
    expect(createBigramTokenizer("AB")).toEqual(["ab"]);
  });
});

describe("buildFaqIndex", () => {
  const faqs = [
    {
      id: "1",
      question: "メンバーを追加するには？",
      answer: "ユーザーIDを入力します",
      sortOrder: 0,
    },
    {
      id: "2",
      question: "フレンドとは何ですか？",
      answer: "よく一緒に旅行する相手",
      sortOrder: 1,
    },
  ];

  it("returns matching FAQ for relevant query", () => {
    const index = buildFaqIndex(faqs);
    const results = index.search("メンバー");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe("1");
  });

  it("returns empty array when query has no match", () => {
    const index = buildFaqIndex(faqs);
    const results = index.search("zzzzzzzzzzz");
    expect(results).toHaveLength(0);
  });
});
