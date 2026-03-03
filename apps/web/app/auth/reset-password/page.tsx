"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { validatePassword } from "@/lib/constants";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenValue = token ?? "";

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="space-y-4 text-center">
          <div
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            無効なリンクです。
          </div>
          <Link href="/auth/forgot-password" className="text-sm underline">
            パスワードリセットをやり直す
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const { valid, errors } = validatePassword(newPassword);
    if (!valid) {
      setError(`パスワードの要件を満たしていません: ${errors.join("、")}`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("パスワードが一致しません。");
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword,
        token: tokenValue,
      });
      if (result.error) {
        if (result.error.status === 400) {
          setError("リンクが無効または期限切れです。もう一度リセットをお試しください。");
        } else {
          setError("パスワードのリセットに失敗しました。");
        }
        return;
      }
      toast.success("パスワードを変更しました。");
      router.push("/auth/login");
    } catch {
      setError("パスワードのリセットに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold">新しいパスワードを設定</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新しいパスワード</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">確認用パスワード</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
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
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !newPassword || !confirmPassword}
            >
              {loading ? "設定中..." : "設定する"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
