import { asc } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { faqs } from "../db/schema";

const faqRoutes = new Hono();

faqRoutes.get("/api/faqs", async (c) => {
  const rows = await db
    .select({
      id: faqs.id,
      question: faqs.question,
      answer: faqs.answer,
      sortOrder: faqs.sortOrder,
    })
    .from(faqs)
    .orderBy(asc(faqs.sortOrder));
  return c.json(rows);
});

export { faqRoutes };
