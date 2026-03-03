"use client";

import { DUMMY_EMAIL_DOMAIN } from "@sugara/shared";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="font-medium">メールアドレス</h3>
        <p className="text-sm text-muted-foreground">パスワードリセット時に使用します。</p>
      </div>

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
        <p className="text-sm text-green-600">
          確認メールを送信しました。メールのリンクをクリックして設定を完了してください。
        </p>
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
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading || !newEmail.trim()}>
            {loading ? "送信中..." : "確認メールを送信"}
          </Button>
        </form>
      )}
    </section>
  );
}
