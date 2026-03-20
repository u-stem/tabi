import { describe, expect, it } from "vitest";
import { getPasswordRequirementsText, validatePassword } from "../constants";

// Simulate translation function for tests
const pwT = {
  rules: (key: string, params?: Record<string, unknown>) => {
    const labels: Record<string, string> = {
      minLength: `${params?.count ?? 8} chars min`,
      lowercase: "lowercase required",
      uppercase: "uppercase required",
      digit: "digit required",
    };
    return labels[key] ?? key;
  },
  separator: ", ",
};

describe("validatePassword", () => {
  it("accepts a valid password", () => {
    expect(validatePassword("Password1", pwT)).toEqual({ valid: true, errors: [] });
  });

  it("rejects password shorter than 8 characters", () => {
    const result = validatePassword("Pass1", pwT);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("8 chars min");
  });

  it("rejects password without lowercase", () => {
    const result = validatePassword("PASSWORD1", pwT);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("lowercase required");
  });

  it("rejects password without uppercase", () => {
    const result = validatePassword("password1", pwT);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("uppercase required");
  });

  it("rejects password without number", () => {
    const result = validatePassword("Passwordx", pwT);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("digit required");
  });

  it("returns multiple errors for weak password", () => {
    const result = validatePassword("abc", pwT);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("8 chars min");
    expect(result.errors).toContain("uppercase required");
    expect(result.errors).toContain("digit required");
  });

  it("accepts password at exactly 8 characters", () => {
    expect(validatePassword("Abcdefg1", pwT)).toEqual({ valid: true, errors: [] });
  });

  it("returns keys when no translation provided", () => {
    const result = validatePassword("abc");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("minLength");
    expect(result.errors).toContain("uppercase");
    expect(result.errors).toContain("digit");
  });
});

describe("getPasswordRequirementsText", () => {
  it("returns comma-separated requirements with translations", () => {
    const text = getPasswordRequirementsText(pwT);
    expect(text).toBe("8 chars min, lowercase required, uppercase required, digit required");
  });

  it("returns keys when no translation provided", () => {
    const text = getPasswordRequirementsText();
    expect(text).toBe("minLength, lowercase, uppercase, digit");
  });
});
