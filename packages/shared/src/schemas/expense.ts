import { z } from "zod";

export const EXPENSE_TITLE_MAX_LENGTH = 200;

export const expenseSplitTypeSchema = z.enum(["equal", "custom"]);
export type ExpenseSplitType = z.infer<typeof expenseSplitTypeSchema>;

const splitItemSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(0).optional(),
});

export const createExpenseSchema = z
  .object({
    title: z.string().min(1).max(EXPENSE_TITLE_MAX_LENGTH),
    amount: z.number().int().min(1),
    paidByUserId: z.string().uuid(),
    splitType: expenseSplitTypeSchema,
    splits: z.array(splitItemSchema).min(1),
  })
  .refine(
    (data) => {
      const ids = data.splits.map((s) => s.userId);
      return new Set(ids).size === ids.length;
    },
    { message: "Duplicate userId in splits", path: ["splits"] },
  )
  .refine(
    (data) => {
      if (data.splitType === "custom") {
        return data.splits.every((s) => s.amount !== undefined);
      }
      return true;
    },
    { message: "Custom splits require amount for each member", path: ["splits"] },
  )
  .refine(
    (data) => {
      if (data.splitType === "custom") {
        const total = data.splits.reduce((sum, s) => sum + (s.amount ?? 0), 0);
        return total === data.amount;
      }
      return true;
    },
    { message: "Split amounts must equal total amount", path: ["splits"] },
  );

export const updateExpenseSchema = z
  .object({
    title: z.string().min(1).max(EXPENSE_TITLE_MAX_LENGTH),
    amount: z.number().int().min(1),
    paidByUserId: z.string().uuid(),
    splitType: expenseSplitTypeSchema,
    splits: z.array(splitItemSchema).min(1),
  })
  .partial()
  .refine(
    (data) => {
      if (data.splits) {
        const ids = data.splits.map((s) => s.userId);
        return new Set(ids).size === ids.length;
      }
      return true;
    },
    { message: "Duplicate userId in splits", path: ["splits"] },
  )
  .refine(
    (data) => {
      if (data.splitType === "custom" && data.splits) {
        return data.splits.every((s) => s.amount !== undefined);
      }
      return true;
    },
    { message: "Custom splits require amount for each member", path: ["splits"] },
  )
  .refine(
    (data) => {
      if (data.splitType === "custom" && data.splits && data.amount !== undefined) {
        const total = data.splits.reduce((sum, s) => sum + (s.amount ?? 0), 0);
        return total === data.amount;
      }
      return true;
    },
    { message: "Split amounts must equal total amount", path: ["splits"] },
  );
