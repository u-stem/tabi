import { asc, eq } from "drizzle-orm";
import { db } from "../db/index";
import { faqs } from "../db/schema";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
};

export async function getFaqs(locale = "ja"): Promise<FaqItem[]> {
  return db
    .select({
      id: faqs.id,
      question: faqs.question,
      answer: faqs.answer,
      category: faqs.category,
      sortOrder: faqs.sortOrder,
    })
    .from(faqs)
    .where(eq(faqs.locale, locale))
    .orderBy(asc(faqs.sortOrder));
}
