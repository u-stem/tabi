"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="flex min-h-screen flex-col">
        <header className="container flex h-14 items-center">
          <Logo href="/" />
        </header>
        <main className="flex flex-1 flex-col items-center justify-center px-0 sm:px-4">
          <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
            <CardContent className="space-y-4 pt-6 text-center">
              <div
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                無効なリンクです。
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/auth/forgot-password">
                  <ArrowLeft className="h-4 w-4" />
                  パスワードリセットをやり直す
                </Link>
              </Button>
            </CardContent>
          </Card>
        </main>
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
      <main className="flex flex-1 flex-col items-center justify-center px-0 sm:px-4">
        <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">新しいパスワードを設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">
                  新しいパスワード <span className="text-destructive">*</span>
                </Label>
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
                <Label htmlFor="confirm-password">
                  確認用パスワード <span className="text-destructive">*</span>
                </Label>
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
                <KeyRound className="h-4 w-4" />
                {loading ? "設定中..." : "設定する"}
              </Button>
            </form>

            <Button variant="outline" className="w-full" asChild>
              <Link href="/auth/login">
                <ArrowLeft className="h-4 w-4" />
                ログインに戻る
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
