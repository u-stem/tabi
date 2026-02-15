import { describe, expect, it } from "vitest";
import {
  acceptFriendRequestSchema,
  addMemberSchema,
  createDayPatternSchema,
  createFeedbackSchema,
  DAY_MEMO_MAX_LENGTH,
  deleteAccountSchema,
  FEEDBACK_BODY_MAX_LENGTH,
  friendRequestSchema,
  PATTERN_LABEL_MAX_LENGTH,
  updateDayPatternSchema,
  updateMemberRoleSchema,
  updateTripDaySchema,
} from "../index";

describe("createDayPatternSchema", () => {
  it("accepts a valid label", () => {
    const result = createDayPatternSchema.safeParse({ label: "Plan A" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty label", () => {
    const result = createDayPatternSchema.safeParse({ label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a label exceeding max length", () => {
    const result = createDayPatternSchema.safeParse({
      label: "a".repeat(PATTERN_LABEL_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDayPatternSchema", () => {
  it("accepts partial update with label", () => {
    const result = updateDayPatternSchema.safeParse({ label: "Updated" });
    expect(result.success).toBe(true);
  });

  it("accepts partial update with sortOrder", () => {
    const result = updateDayPatternSchema.safeParse({ sortOrder: 2 });
    expect(result.success).toBe(true);
  });

  it("rejects negative sortOrder", () => {
    const result = updateDayPatternSchema.safeParse({ sortOrder: -1 });
    expect(result.success).toBe(false);
  });
});

describe("addMemberSchema", () => {
  it("accepts valid editor role", () => {
    const result = addMemberSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "editor",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid viewer role", () => {
    const result = addMemberSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "viewer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects owner role", () => {
    const result = addMemberSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-uuid userId", () => {
    const result = addMemberSchema.safeParse({ userId: "not-a-uuid", role: "editor" });
    expect(result.success).toBe(false);
  });
});

describe("updateMemberRoleSchema", () => {
  it("accepts editor role", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "editor" });
    expect(result.success).toBe(true);
  });

  it("rejects owner role", () => {
    const result = updateMemberRoleSchema.safeParse({ role: "owner" });
    expect(result.success).toBe(false);
  });
});

describe("friendRequestSchema", () => {
  it("accepts valid uuid", () => {
    const result = friendRequestSchema.safeParse({
      addresseeId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid", () => {
    const result = friendRequestSchema.safeParse({ addresseeId: "abc" });
    expect(result.success).toBe(false);
  });
});

describe("acceptFriendRequestSchema", () => {
  it("accepts 'accepted' status", () => {
    const result = acceptFriendRequestSchema.safeParse({ status: "accepted" });
    expect(result.success).toBe(true);
  });

  it("rejects other status values", () => {
    const result = acceptFriendRequestSchema.safeParse({ status: "rejected" });
    expect(result.success).toBe(false);
  });
});

describe("deleteAccountSchema", () => {
  it("accepts a non-empty password", () => {
    const result = deleteAccountSchema.safeParse({ password: "secret123" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = deleteAccountSchema.safeParse({ password: "" });
    expect(result.success).toBe(false);
  });
});

describe("createFeedbackSchema", () => {
  it("accepts valid body", () => {
    const result = createFeedbackSchema.safeParse({ body: "Great app!" });
    expect(result.success).toBe(true);
  });

  it("rejects empty body", () => {
    const result = createFeedbackSchema.safeParse({ body: "" });
    expect(result.success).toBe(false);
  });

  it("rejects body exceeding max length", () => {
    const result = createFeedbackSchema.safeParse({
      body: "a".repeat(FEEDBACK_BODY_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTripDaySchema", () => {
  it("accepts a valid memo", () => {
    const result = updateTripDaySchema.safeParse({ memo: "Remember sunscreen" });
    expect(result.success).toBe(true);
  });

  it("accepts null memo", () => {
    const result = updateTripDaySchema.safeParse({ memo: null });
    expect(result.success).toBe(true);
  });

  it("rejects memo exceeding max length", () => {
    const result = updateTripDaySchema.safeParse({ memo: "a".repeat(DAY_MEMO_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
  });
});
