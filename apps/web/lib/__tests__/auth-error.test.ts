import { describe, expect, it } from "vitest";
import { translateAuthError } from "../auth-error";

describe("translateAuthError", () => {
  it("returns Japanese message for known error code", () => {
    const error = { code: "INVALID_USERNAME_OR_PASSWORD", message: "Invalid username or password" };
    expect(translateAuthError(error, "fallback")).toBe(
      "ユーザー名またはパスワードが正しくありません",
    );
  });

  it("returns fallback for unknown error code", () => {
    const error = { code: "UNKNOWN_CODE", message: "Something went wrong" };
    expect(translateAuthError(error, "フォールバック")).toBe("フォールバック");
  });

  it("returns fallback when error is undefined", () => {
    expect(translateAuthError(undefined, "フォールバック")).toBe("フォールバック");
  });

  it("returns fallback when error has no code", () => {
    const error = { message: "Something went wrong" };
    expect(translateAuthError(error, "フォールバック")).toBe("フォールバック");
  });

  it("translates all mapped error codes", () => {
    const expectedCodes = [
      "INVALID_USERNAME_OR_PASSWORD",
      "INVALID_EMAIL_OR_PASSWORD",
      "CREDENTIAL_ACCOUNT_NOT_FOUND",
      "USER_NOT_FOUND",
      "USER_ALREADY_EXISTS",
      "USERNAME_IS_ALREADY_TAKEN",
      "USERNAME_TOO_SHORT",
      "USERNAME_TOO_LONG",
      "INVALID_USERNAME",
      "INVALID_DISPLAY_USERNAME",
      "PASSWORD_TOO_SHORT",
      "PASSWORD_TOO_LONG",
      "INVALID_PASSWORD",
      "SESSION_EXPIRED",
      "FAILED_TO_UPDATE_USER",
      "FAILED_TO_CREATE_USER",
    ];

    for (const code of expectedCodes) {
      const result = translateAuthError({ code }, "fallback");
      expect(result, `code "${code}" should be translated`).not.toBe("fallback");
    }
  });
});
