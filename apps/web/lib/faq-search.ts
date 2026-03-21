import MiniSearch from "minisearch";

export type SearchableFaq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
};

export function createBigramTokenizer(text: string): string[] {
  const normalized = text.toLowerCase().replace(/\s+/g, "");
  if (normalized.length === 0) return [];
  if (normalized.length === 1) return [normalized];
  const ngrams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    ngrams.push(normalized.slice(i, i + 2));
  }
  return ngrams;
}

export function buildFaqIndex(faqs: SearchableFaq[]): MiniSearch<SearchableFaq> {
  const ms = new MiniSearch<SearchableFaq>({
    fields: ["question", "answer"],
    storeFields: ["id", "question", "answer", "category", "sortOrder"],
    tokenize: createBigramTokenizer,
    searchOptions: {
      boost: { question: 2 },
      fuzzy: 0.1,
      prefix: true,
    },
  });
  ms.addAll(faqs);
  return ms;
}
