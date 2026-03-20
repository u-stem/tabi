import { getAppSettings } from "@sugara/api/lib/app-settings";
import { ArrowRight, CalendarDays, Dices, Gift, LogIn, Receipt, Vote, Zap } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const FEATURE_KEYS = [
  { key: "schedule" as const, icon: CalendarDays },
  { key: "realtime" as const, icon: Zap },
  { key: "expense" as const, icon: Receipt },
  { key: "poll" as const, icon: Vote },
  { key: "souvenir" as const, icon: Gift },
  { key: "roulette" as const, icon: Dices },
];

export default async function HomePage() {
  const { signupEnabled } = await getAppSettings();
  const t = await getTranslations("home");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center px-4 pt-24 pb-16 text-center sm:pt-32 sm:pb-20">
          <h1 className="text-2xl font-bold tracking-tight sm:text-5xl">{t("heroTitle")}</h1>
          <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            {t("description")}
          </p>
          {signupEnabled ? (
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/signup">
                  <ArrowRight className="h-4 w-4" />
                  {t("signup")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">
                  <LogIn className="h-4 w-4" />
                  {t("login")}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center gap-4">
              <p className="text-sm text-muted-foreground">{t("signupDisabled")}</p>
              <Button asChild variant="outline" size="lg">
                <Link href="/auth/login">
                  <LogIn className="h-4 w-4" />
                  {t("login")}
                </Link>
              </Button>
            </div>
          )}
        </section>

        {/* Features */}
        <section className="container max-w-4xl px-4 pb-24 sm:pb-32">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURE_KEYS.map((f) => (
              <div key={f.key} className="rounded-lg border p-5">
                <div className="flex items-center gap-2">
                  <f.icon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="font-medium">{t(`features.${f.key}.title`)}</h2>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`features.${f.key}.description`)}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.faq")}
        </Link>
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.news")}
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.terms")}
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          {t("footer.privacy")}
        </Link>
      </footer>
    </div>
  );
}
