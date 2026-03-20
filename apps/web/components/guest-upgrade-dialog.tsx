"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { signUp } from "@/lib/auth-client";
import {
  getPasswordRequirementsText,
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "@/lib/constants";

export function GuestUpgradeDialog({
  open,
  onOpenChange,
  signupEnabled = true,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  signupEnabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("auth");
  const tm = useTranslations("messages");
  const te = useTranslations("authErrors");
  const tc = useTranslations("common");
  const tpr = useTranslations("passwordRules");
  const pwT = {
    rules: (key: string, params?: Record<string, string | number | Date>) =>
      tpr(key as "minLength", params),
    separator: tpr("separator"),
  };
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const name = formData.get("name") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const { valid, errors } = validatePassword(password, pwT);
    if (!valid) {
      setError(`${tm("authPasswordTooWeak")}: ${errors.join(pwT.separator)}`);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(tm("authSignupPasswordMismatch"));
      setLoading(false);
      return;
    }

    const result = await signUp.email({
      username,
      name,
      email: `${username}@sugara.local`,
      password,
    });

    if (result.error) {
      // 403 = signup disabled by admin
      let msg: string;
      if (result.error.status === 403) {
        msg = tm("authSignupDisabled");
      } else {
        const code = result.error.code;
        msg =
          code && (te.has as (k: string) => boolean)(code)
            ? (te as (k: string) => string)(code)
            : tm("authGuestUpgradeFailed");
      }
      setError(msg);
      setLoading(false);
      return;
    }

    toast.success(tm("authGuestUpgradeSuccess"));
    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  if (!signupEnabled) {
    return (
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t("guestUpgradeTitle")}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <p className="px-1 py-2 text-sm text-muted-foreground">
            {tm("authSignupDisabledDetail")}
          </p>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{t("guestUpgradeTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{t("guestUpgradeDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="upgrade-username">
                {t("username")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upgrade-username"
                name="username"
                pattern="^[a-zA-Z0-9_]+$"
                title={t("usernameHint")}
                minLength={3}
                maxLength={20}
                required
              />
              <p className="text-xs text-muted-foreground">{t("usernameHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-name">
                {t("displayName")} <span className="text-destructive">*</span>
              </Label>
              <Input id="upgrade-name" name="name" minLength={1} maxLength={50} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-password">
                {t("password")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upgrade-password"
                name="password"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <p className="text-xs text-muted-foreground">{getPasswordRequirementsText(pwT)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-confirmPassword">
                {t("passwordConfirm")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="upgrade-confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
            </div>
            {error && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
          </div>
          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("signingUp") : t("register")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
