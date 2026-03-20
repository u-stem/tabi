import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const SUPPORTED_LOCALES = ["ja", "en"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
const DEFAULT_LOCALE: Locale = "ja";

function isSupported(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string): Locale {
  if (cookieValue && isSupported(cookieValue)) {
    return cookieValue;
  }
  const preferred = acceptLanguage.split(",")[0]?.split("-")[0]?.trim();
  return preferred && isSupported(preferred) ? preferred : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const acceptLang = (await headers()).get("accept-language") ?? "";
  const locale = resolveLocale(cookieLocale, acceptLang);

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
