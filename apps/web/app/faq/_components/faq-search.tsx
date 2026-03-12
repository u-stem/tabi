"use client";

import type { SearchResult } from "minisearch";
import { useMemo, useState } from "react";
import type { SearchableFaq } from "@/lib/faq-search";
import { buildFaqIndex } from "@/lib/faq-search";

type Props = {
  faqs: SearchableFaq[];
};

export function FaqSearch({ faqs }: Props) {
  const [query, setQuery] = useState("");

  const index = useMemo(() => buildFaqIndex(faqs), [faqs]);

  const results = useMemo<SearchableFaq[]>(() => {
    if (!query.trim()) return faqs;
    return index.search(query) as Array<SearchResult & SearchableFaq>;
  }, [index, faqs, query]);

  return (
    <div className="mt-6 space-y-4">
      <input
        type="search"
        placeholder="質問を入力..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {query.trim() !== "" && results.length === 0 && (
        <p className="text-sm text-muted-foreground">見つかりませんでした</p>
      )}

      <div className="space-y-3">
        {results.map((faq) => (
          <div key={faq.id} className="rounded-lg border bg-card p-4 text-card-foreground">
            <p className="font-medium">{faq.question}</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
