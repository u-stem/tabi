export { MAX_LOGS_PER_TRIP } from "@sugara/shared";

export const SITE_NAME = "sugara";

export function pageTitle(title: string): string {
  return `${title} - ${SITE_NAME}`;
}

export const MIN_PASSWORD_LENGTH = 8;
export const PROFILE_NAME_MAX_LENGTH = 50;

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= MIN_PASSWORD_LENGTH, label: `${MIN_PASSWORD_LENGTH}文字以上` },
  { test: (p: string) => /[a-z]/.test(p), label: "英小文字を含む" },
  { test: (p: string) => /[A-Z]/.test(p), label: "英大文字を含む" },
  { test: (p: string) => /[0-9]/.test(p), label: "数字を含む" },
] as const;

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors = PASSWORD_RULES.filter((r) => !r.test(password)).map((r) => r.label);
  return { valid: errors.length === 0, errors };
}

export function getPasswordRequirementsText(): string {
  return PASSWORD_RULES.map((r) => r.label).join("、");
}
