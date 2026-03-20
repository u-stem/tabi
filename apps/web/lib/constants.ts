export { MAX_LOGS_PER_TRIP } from "@sugara/shared";

export const SITE_NAME = "sugara";

export function pageTitle(title: string): string {
  return `${title} - ${SITE_NAME}`;
}

export const MIN_PASSWORD_LENGTH = 8;
export const PROFILE_NAME_MAX_LENGTH = 50;

type PasswordRule = {
  test: (p: string) => boolean;
  // Key in passwordRules namespace
  key: string;
};

const PASSWORD_RULES: PasswordRule[] = [
  { test: (p: string) => p.length >= MIN_PASSWORD_LENGTH, key: "minLength" },
  { test: (p: string) => /[a-z]/.test(p), key: "lowercase" },
  { test: (p: string) => /[A-Z]/.test(p), key: "uppercase" },
  { test: (p: string) => /[0-9]/.test(p), key: "digit" },
];

type PasswordTranslations = {
  rules: (key: string, params?: Record<string, string | number | Date>) => string;
  separator: string;
};

export function validatePassword(
  password: string,
  t?: PasswordTranslations,
): { valid: boolean; errors: string[] } {
  const errors = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => {
    if (t) {
      const params = r.key === "minLength" ? { count: MIN_PASSWORD_LENGTH } : undefined;
      return t.rules(r.key, params);
    }
    // Fallback for non-i18n contexts (e.g. tests)
    return r.key;
  });
  return { valid: errors.length === 0, errors };
}

export function getPasswordRequirementsText(t?: PasswordTranslations): string {
  const labels = PASSWORD_RULES.map((r) => {
    if (t) {
      const params = r.key === "minLength" ? { count: MIN_PASSWORD_LENGTH } : undefined;
      return t.rules(r.key, params);
    }
    return r.key;
  });
  return labels.join(t?.separator ?? ", ");
}
