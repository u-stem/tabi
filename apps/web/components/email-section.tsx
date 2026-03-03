"use client";

import { DUMMY_EMAIL_DOMAIN } from "@sugara/shared";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Props = {
  currentEmail: string;
  emailVerified: boolean;
};

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const masked = local[0] + "*".repeat(Math.max(local.length - 1, 2));
  return `${masked}@${domain}`;
}

function isRealEmail(email: string): boolean {
  return !email.endsWith(`@${DUMMY_EMAIL_DOMAIN}`);
}

export function EmailSection({ currentEmail, emailVerified }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const hasRealEmail = isRealEmail(currentEmail);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!newEmail.trim()) return;
    if (newEmail === currentEmail) {
      setError("現在のメールアドレスと同じです。");
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.changeEmail({
        newEmail: newEmail.trim(),
        callbackURL: "/settings?emailVerified=1",
      });
      if (result.error) {
        setError(result.error.message ?? "メールアドレスの変更に失敗しました。");
        return;
      }
      setSent(true);
      setNewEmail("");
    } catch {
      setError("メールアドレスの変更に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>メールアドレス</CardTitle>
        <CardDescription>パスワードリセット時に使用します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {hasRealEmail ? (
            <>
              <span className="text-sm">{maskEmail(currentEmail)}</span>
              {!emailVerified && <Badge variant="secondary">未確認</Badge>}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">未設定</span>
          )}
        </div>

        {sent ? (
          <output
            aria-live="polite"
            className="block rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/20 dark:text-green-400"
          >
            確認メールを送信しました。メールのリンクをクリックして設定を完了してください。
          </output>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-email">
                {hasRealEmail ? "新しいメールアドレス" : "メールアドレスを登録"}
              </Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="example@gmail.com"
                autoComplete="email"
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
            <Button type="submit" disabled={loading || !newEmail.trim()}>
              {loading ? "送信中..." : "確認メールを送信"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
