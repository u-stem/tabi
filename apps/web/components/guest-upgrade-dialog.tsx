"use client";

import { useRouter } from "next/navigation";
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
import { translateAuthError } from "@/lib/auth-error";
import {
  getPasswordRequirementsText,
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "@/lib/constants";
import { MSG } from "@/lib/messages";

export function GuestUpgradeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
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

    const { valid, errors } = validatePassword(password);
    if (!valid) {
      setError(`${MSG.AUTH_PASSWORD_TOO_WEAK}: ${errors.join("、")}`);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(MSG.AUTH_SIGNUP_PASSWORD_MISMATCH);
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
      setError(translateAuthError(result.error, MSG.AUTH_GUEST_UPGRADE_FAILED));
      setLoading(false);
      return;
    }

    toast.success(MSG.AUTH_GUEST_UPGRADE_SUCCESS);
    setLoading(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>アカウント登録</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            登録するとデータが保持され、全機能が使えるようになります。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="upgrade-username">ユーザー名</Label>
              <Input
                id="upgrade-username"
                name="username"
                pattern="^[a-zA-Z0-9_]+$"
                title="英数字とアンダースコアのみ"
                minLength={3}
                maxLength={20}
                required
              />
              <p className="text-xs text-muted-foreground">3〜20文字、英数字とアンダースコアのみ</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-name">表示名</Label>
              <Input id="upgrade-name" name="name" minLength={1} maxLength={50} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-password">パスワード</Label>
              <Input
                id="upgrade-password"
                name="password"
                type="password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <p className="text-xs text-muted-foreground">{getPasswordRequirementsText()}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="upgrade-confirmPassword">パスワード（確認）</Label>
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
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "登録中..." : "登録"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
