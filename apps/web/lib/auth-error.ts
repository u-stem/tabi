// Maps Better Auth error codes to Japanese messages.
// Only codes relevant to this app's auth flows are included.
const AUTH_ERROR_MAP: Record<string, string> = {
  // Login
  INVALID_USERNAME_OR_PASSWORD: "ユーザー名またはパスワードが正しくありません",
  INVALID_EMAIL_OR_PASSWORD: "ユーザー名またはパスワードが正しくありません",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "アカウントが見つかりません",
  USER_NOT_FOUND: "ユーザーが見つかりません",

  // Signup
  USER_ALREADY_EXISTS: "このユーザーは既に登録されています",
  USERNAME_IS_ALREADY_TAKEN: "このユーザー名は既に使用されています",
  USERNAME_TOO_SHORT: "ユーザー名が短すぎます",
  USERNAME_TOO_LONG: "ユーザー名が長すぎます",
  INVALID_USERNAME: "ユーザー名が無効です",
  INVALID_DISPLAY_USERNAME: "表示用ユーザー名が無効です",
  PASSWORD_TOO_SHORT: "パスワードが短すぎます",
  PASSWORD_TOO_LONG: "パスワードが長すぎます",

  // Password change
  INVALID_PASSWORD: "現在のパスワードが正しくありません",
  SESSION_EXPIRED: "セッションが期限切れです。再度ログインしてください",

  // Profile update
  FAILED_TO_UPDATE_USER: "ユーザー情報の更新に失敗しました",
  FAILED_TO_CREATE_USER: "ユーザーの作成に失敗しました",
};

export function translateAuthError(
  error: { code?: string; message?: string } | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  if (error.code && error.code in AUTH_ERROR_MAP) {
    return AUTH_ERROR_MAP[error.code];
  }
  return fallback;
}
