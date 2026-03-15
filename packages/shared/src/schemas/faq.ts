import { z } from "zod";

export const faqSchema = z.object({
  id: z.string().check(z.guid()),
  question: z.string(),
  answer: z.string(),
  sortOrder: z.number().int(),
});

export type Faq = z.infer<typeof faqSchema>;
