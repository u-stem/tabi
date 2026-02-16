"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-error";
import { MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { MSG } from "@/lib/messages";

export function AuthForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");
    if (typeof username !== "string" || typeof password !== "string") {
      setLoading(false);
      return;
    }

    const result = await signIn.username({ username, password });
    if (result.error) {
      setError(translateAuthError(result.error, MSG.AUTH_LOGIN_FAILED));
      setLoading(false);
      return;
    }
    toast.success(MSG.AUTH_LOGIN_SUCCESS);
    setLoading(false);
    router.push("/home");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">ログイン</CardTitle>
        <CardDescription>ユーザー名でログイン</CardDescription>
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
              required
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
              placeholder="パスワード"
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="current-password"
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
          <Button type="submit" className="w-full" disabled={loading}>
            <LogIn className="h-4 w-4" />
            {loading ? "ログイン中..." : "ログイン"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            アカウントをお持ちでない方は{" "}
            <Link href="/auth/signup" className="text-foreground underline underline-offset-4">
              新規登録
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
