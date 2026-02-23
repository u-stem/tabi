import { describe, expect, it } from "vitest";
import { updateExpenseSchema } from "../schemas/expense";

describe("updateExpenseSchema", () => {
  it("rejects splitType without splits", () => {
    const result = updateExpenseSchema.safeParse({ splitType: "custom" });
    expect(result.success).toBe(false);
  });

  it("rejects splits without splitType", () => {
    const result = updateExpenseSchema.safeParse({
      splits: [{ userId: "550e8400-e29b-41d4-a716-446655440000", amount: 500 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts splitType with splits and amount together", () => {
    const result = updateExpenseSchema.safeParse({
      splitType: "custom",
      amount: 1000,
      splits: [
        { userId: "550e8400-e29b-41d4-a716-446655440000", amount: 600 },
        { userId: "550e8400-e29b-41d4-a716-446655440001", amount: 400 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts title-only update", () => {
    const result = updateExpenseSchema.safeParse({ title: "Dinner" });
    expect(result.success).toBe(true);
  });

  it("accepts amount-only update", () => {
    const result = updateExpenseSchema.safeParse({ amount: 2000 });
    expect(result.success).toBe(true);
  });

  it("accepts equal split with splits and amount", () => {
    const result = updateExpenseSchema.safeParse({
      splitType: "equal",
      amount: 1000,
      splits: [
        { userId: "550e8400-e29b-41d4-a716-446655440000" },
        { userId: "550e8400-e29b-41d4-a716-446655440001" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
