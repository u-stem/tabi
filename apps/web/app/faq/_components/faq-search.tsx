"use client";

import type { SearchResult } from "minisearch";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { SearchableFaq } from "@/lib/faq-search";
import { buildFaqIndex } from "@/lib/faq-search";

type Props = {
  faqs: SearchableFaq[];
};

function groupByCategory(faqs: SearchableFaq[]): [string, SearchableFaq[]][] {
  const groups = new Map<string, SearchableFaq[]>();
  for (const faq of faqs) {
    const existing = groups.get(faq.category);
    if (existing) {
      existing.push(faq);
    } else {
      groups.set(faq.category, [faq]);
    }
  }
  return Array.from(groups.entries());
}

export function FaqSearch({ faqs }: Props) {
  const t = useTranslations("faq");
  const [query, setQuery] = useState("");

  const index = useMemo(() => buildFaqIndex(faqs), [faqs]);

  const results = useMemo<SearchableFaq[]>(() => {
    if (!query.trim()) return faqs;
    return index.search(query) as Array<SearchResult & SearchableFaq>;
  }, [index, faqs, query]);

  const isSearching = query.trim() !== "";
  const grouped = useMemo(() => groupByCategory(results), [results]);

  return (
    <div className="mt-6 space-y-4">
      <input
        type="search"
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {isSearching && results.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("noResults")}</p>
      )}

      <div className="space-y-6">
        {grouped.map(([category, items]) => (
          <section key={category}>
            {!isSearching && (
              <h2 className="mb-3 text-lg font-semibold">
                {t(`category.${category}` as Parameters<typeof t>[0])}
              </h2>
            )}
            <div className="space-y-3">
              {items.map((faq) => (
                <div key={faq.id} className="rounded-lg border bg-card p-4 text-card-foreground">
                  <p className="font-medium">{faq.question}</p>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
