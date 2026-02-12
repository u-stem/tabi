import { describe, expect, it } from "vitest";
import { getPasswordRequirementsText, validatePassword } from "../constants";

describe("validatePassword", () => {
  it("accepts a valid password", () => {
    expect(validatePassword("Password1")).toEqual({ valid: true, errors: [] });
  });

  it("rejects password shorter than 8 characters", () => {
    const result = validatePassword("Pass1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("8文字以上");
  });

  it("rejects password without lowercase", () => {
    const result = validatePassword("PASSWORD1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("英小文字を含む");
  });

  it("rejects password without uppercase", () => {
    const result = validatePassword("password1");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("英大文字を含む");
  });

  it("rejects password without number", () => {
    const result = validatePassword("Passwordx");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("数字を含む");
  });

  it("returns multiple errors for weak password", () => {
    const result = validatePassword("abc");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("8文字以上");
    expect(result.errors).toContain("英大文字を含む");
    expect(result.errors).toContain("数字を含む");
  });

  it("accepts password at exactly 8 characters", () => {
    expect(validatePassword("Abcdefg1")).toEqual({ valid: true, errors: [] });
  });
});

describe("getPasswordRequirementsText", () => {
  it("returns comma-separated requirements", () => {
    const text = getPasswordRequirementsText();
    expect(text).toBe("8文字以上、英小文字を含む、英大文字を含む、数字を含む");
  });
});
