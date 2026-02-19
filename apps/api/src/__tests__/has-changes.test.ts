import { describe, expect, it } from "vitest";
import { hasChanges } from "../lib/has-changes";

describe("hasChanges", () => {
  it("returns false when no fields differ", () => {
    const existing = { name: "foo", memo: null };
    const updates = { name: "foo" };
    expect(hasChanges(existing, updates)).toBe(false);
  });

  it("returns true when a field differs", () => {
    const existing = { name: "foo", memo: null };
    const updates = { name: "bar" };
    expect(hasChanges(existing, updates)).toBe(true);
  });

  it("ignores undefined fields in updates", () => {
    const existing = { name: "foo", memo: "old" };
    const updates = { name: "foo", memo: undefined };
    expect(hasChanges(existing, updates)).toBe(false);
  });

  it("detects null to string change", () => {
    const existing = { memo: null };
    const updates = { memo: "new" };
    expect(hasChanges(existing, updates)).toBe(true);
  });

  it("detects string to null change", () => {
    const existing = { memo: "old" };
    const updates = { memo: null };
    expect(hasChanges(existing, updates)).toBe(true);
  });

  it("compares arrays by value", () => {
    const existing = { urls: ["https://a.com"] };
    const updates = { urls: ["https://a.com"] };
    expect(hasChanges(existing, updates)).toBe(false);
  });

  it("detects array changes", () => {
    const existing = { urls: ["https://a.com"] };
    const updates = { urls: ["https://b.com"] };
    expect(hasChanges(existing, updates)).toBe(true);
  });

  it("compares Date objects by value", () => {
    const d = new Date("2025-07-01T00:00:00Z");
    const existing = { deadline: d };
    const updates = { deadline: new Date("2025-07-01T00:00:00Z") };
    expect(hasChanges(existing, updates)).toBe(false);
  });

  it("detects Date changes", () => {
    const existing = { deadline: new Date("2025-07-01T00:00:00Z") };
    const updates = { deadline: new Date("2025-08-01T00:00:00Z") };
    expect(hasChanges(existing, updates)).toBe(true);
  });

  it("detects null to Date change", () => {
    const existing = { deadline: null };
    const updates = { deadline: new Date("2025-07-01T00:00:00Z") };
    expect(hasChanges(existing, updates)).toBe(true);
  });

  it("detects Date to null change", () => {
    const existing = { deadline: new Date("2025-07-01T00:00:00Z") };
    const updates = { deadline: null };
    expect(hasChanges(existing, updates)).toBe(true);
  });
});
