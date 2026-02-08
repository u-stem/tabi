"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signIn, signUp } from "@/lib/auth-client";

type AuthFormProps = {
  mode: "login" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (mode === "signup") {
      const name = formData.get("name") as string;
      const result = await signUp.email({ email, password, name });
      if (result.error) {
        setError(result.error.message ?? "登録に失敗しました");
        setLoading(false);
        return;
      }
      toast.success("アカウントを作成しました");
    } else {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "ログインに失敗しました");
        setLoading(false);
        return;
      }
      toast.success("ログインしました");
    }
    setLoading(false);
    router.push("/dashboard");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">
          {mode === "login" ? "ログイン" : "新規登録"}
        </CardTitle>
        <CardDescription>
          {mode === "login"
            ? "メールアドレスでログイン"
            : "無料でアカウントを作成"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">名前</Label>
              <Input
                id="name"
                name="name"
                placeholder="山田太郎"
                autoComplete="name"
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="8文字以上"
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">
                8文字以上で入力してください
              </p>
            )}
          </div>
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? mode === "login"
                ? "ログイン中..."
                : "登録中..."
              : mode === "login"
                ? "ログイン"
                : "アカウントを作成"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
