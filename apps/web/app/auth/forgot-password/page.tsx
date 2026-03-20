"use client";

import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/auth/reset-password",
      });
    } catch {
      // Show success regardless to prevent email enumeration
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-0 sm:px-4">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{t("resetPasswordTitle")}</CardTitle>
            <CardDescription>{t("resetPasswordDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {sent ? (
              <output
                aria-live="polite"
                className="block space-y-1 rounded-md bg-green-50 px-3 py-3 text-sm text-green-700 dark:bg-green-950/20 dark:text-green-400"
              >
                <p>{t("resetPasswordSent")}</p>
                <p className="text-xs opacity-80">{t("resetPasswordSpamHint")}</p>
              </output>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {t("emailLabel")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !email.trim()}>
                  <Send className="h-4 w-4" />
                  {loading ? t("sending") : t("sendButton")}
                </Button>
              </form>
            )}

            <p className="text-center text-xs text-muted-foreground">{t("noEmailHint")}</p>

            <Button variant="outline" className="w-full" asChild>
              <Link href="/auth/login">
                <ArrowLeft className="h-4 w-4" />
                {t("backToLogin")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
