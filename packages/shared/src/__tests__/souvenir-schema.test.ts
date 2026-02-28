import { describe, expect, it } from "vitest";
import { createSouvenirSchema, updateSouvenirSchema } from "../schemas/souvenir";

describe("createSouvenirSchema", () => {
  it("accepts valid input with name only", () => {
    const result = createSouvenirSchema.safeParse({ name: "Tokyo banana" });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = createSouvenirSchema.safeParse({
      name: "Tokyo banana",
      recipient: "Mom",
      url: "https://example.com",
      address: "Shibuya, Tokyo",
      memo: "Get the matcha flavor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createSouvenirSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 chars", () => {
    const result = createSouvenirSchema.safeParse({ name: "a".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("updateSouvenirSchema", () => {
  it("accepts partial update with isPurchased only", () => {
    const result = updateSouvenirSchema.safeParse({ isPurchased: true });
    expect(result.success).toBe(true);
  });

  it("accepts name update", () => {
    const result = updateSouvenirSchema.safeParse({ name: "New name" });
    expect(result.success).toBe(true);
  });

  it("rejects empty object", () => {
    const result = updateSouvenirSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = updateSouvenirSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts priority-only update", () => {
    const result = updateSouvenirSchema.safeParse({ priority: "high" });
    expect(result.success).toBe(true);
  });

  it("accepts priority null reset", () => {
    const result = updateSouvenirSchema.safeParse({ priority: null });
    expect(result.success).toBe(true);
  });
});

describe("createSouvenirSchema priority", () => {
  it("accepts priority high", () => {
    const result = createSouvenirSchema.safeParse({ name: "Tokyo banana", priority: "high" });
    expect(result.success).toBe(true);
  });

  it("accepts priority medium", () => {
    const result = createSouvenirSchema.safeParse({ name: "Tokyo banana", priority: "medium" });
    expect(result.success).toBe(true);
  });

  it("accepts priority null", () => {
    const result = createSouvenirSchema.safeParse({ name: "Tokyo banana", priority: null });
    expect(result.success).toBe(true);
  });

  it("accepts missing priority (optional)", () => {
    const result = createSouvenirSchema.safeParse({ name: "Tokyo banana" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid priority value", () => {
    const result = createSouvenirSchema.safeParse({ name: "Tokyo banana", priority: "low" });
    expect(result.success).toBe(false);
  });
});
