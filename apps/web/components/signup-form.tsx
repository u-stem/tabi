"use client";

import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-error";
import {
  getPasswordRequirementsText,
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "@/lib/constants";
import { MSG } from "@/lib/messages";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!agreed) {
      setError(MSG.AUTH_SIGNUP_TERMS_REQUIRED);
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username");
    const name = formData.get("name");
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");
    if (
      typeof username !== "string" ||
      typeof name !== "string" ||
      typeof password !== "string" ||
      typeof confirmPassword !== "string"
    ) {
      setLoading(false);
      return;
    }

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
      setError(translateAuthError(result.error, MSG.AUTH_SIGNUP_FAILED));
      setLoading(false);
      return;
    }
    toast.success(MSG.AUTH_SIGNUP_SUCCESS);
    setLoading(false);
    router.push("/home");
  }

  return (
    <Card className="w-full max-w-md border-0 shadow-none sm:border sm:shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">新規登録</CardTitle>
        <CardDescription>アカウントを作成してはじめる</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">
              ユーザー名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              placeholder="taro_123"
              autoComplete="username"
              pattern="^[a-zA-Z0-9_]+$"
              title="英数字とアンダースコアのみ使用できます"
              minLength={3}
              maxLength={20}
              required
            />
            <p className="text-xs text-muted-foreground">3〜20文字、英数字とアンダースコアのみ</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">
              表示名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="たろう"
              autoComplete="name"
              required
              minLength={1}
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              パスワード <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="8文字以上"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <p className="text-xs text-muted-foreground">{getPasswordRequirementsText()}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              パスワード（確認） <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5"
            />
            <Label
              htmlFor="terms"
              className="text-sm font-normal leading-relaxed text-muted-foreground"
            >
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                利用規約
              </a>
              と
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                プライバシーポリシー
              </a>
              に同意する
            </Label>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <Button type="submit" className="h-11 w-full" disabled={loading || !agreed}>
            <UserPlus className="h-4 w-4" />
            {loading ? "登録中..." : "新規登録"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/auth/login" className="text-foreground underline underline-offset-4">
              ログイン
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground">
            ユーザー名・パスワードを忘れてしまうと
            <br />
            ログインができなくなりますのでご注意ください。
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
