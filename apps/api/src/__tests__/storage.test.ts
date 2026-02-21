import { describe, expect, it } from "vitest";
import { validateCoverImage } from "../lib/storage";

describe("validateCoverImage", () => {
  it("returns null for valid JPEG", () => {
    expect(validateCoverImage({ type: "image/jpeg", size: 1024 })).toBeNull();
  });

  it("returns null for valid PNG", () => {
    expect(validateCoverImage({ type: "image/png", size: 1024 })).toBeNull();
  });

  it("returns null for valid WebP", () => {
    expect(validateCoverImage({ type: "image/webp", size: 1024 })).toBeNull();
  });

  it("returns null for file at exactly 3MB", () => {
    expect(validateCoverImage({ type: "image/jpeg", size: 3 * 1024 * 1024 })).toBeNull();
  });

  it("returns error for unsupported type", () => {
    expect(validateCoverImage({ type: "image/gif", size: 1024 })).toBe("JPEG, PNG, WebP only");
  });

  it("returns error for non-image type", () => {
    expect(validateCoverImage({ type: "application/pdf", size: 1024 })).toBe(
      "JPEG, PNG, WebP only",
    );
  });

  it("returns error for file exceeding 3MB", () => {
    expect(validateCoverImage({ type: "image/jpeg", size: 3 * 1024 * 1024 + 1 })).toBe(
      "File size must be 3MB or less",
    );
  });

  it("checks type before size", () => {
    expect(validateCoverImage({ type: "image/gif", size: 3 * 1024 * 1024 + 1 })).toBe(
      "JPEG, PNG, WebP only",
    );
  });
});
