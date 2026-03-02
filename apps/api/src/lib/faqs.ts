import { asc } from "drizzle-orm";
import { db } from "../db/index";
import { faqs } from "../db/schema";

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
};

export async function getFaqs(): Promise<FaqItem[]> {
  return db
    .select({
      id: faqs.id,
      question: faqs.question,
      answer: faqs.answer,
      sortOrder: faqs.sortOrder,
    })
    .from(faqs)
    .orderBy(asc(faqs.sortOrder));
}
