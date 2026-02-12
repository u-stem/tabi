"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-error";
import {
  getPasswordRequirementsText,
  MIN_PASSWORD_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  validatePassword,
} from "@/lib/constants";
import { MSG } from "@/lib/messages";

export default function SettingsPage() {
  const { data: session } = useSession();

  useEffect(() => {
    document.title = "設定 - sugara";
  }, []);

  const user = session?.user;

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      {user && (
        <>
          <UserIdSection userId={user.id} />
          <ProfileSection defaultName={user.name ?? ""} />
          <UsernameSection defaultUsername={user.username ?? ""} />
          <PasswordSection />
        </>
      )}
    </div>
  );
}

function UserIdSection({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      // Fallback for environments where Clipboard API is unavailable
      const textarea = document.createElement("textarea");
      textarea.value = userId;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    toast.success(MSG.SETTINGS_USER_ID_COPIED);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザーID</CardTitle>
        <CardDescription>メンバー追加時にこのIDを共有してください</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
            {userId}
          </code>
          <Button variant="outline" size="icon" onClick={handleCopy} aria-label="コピー">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSection({ defaultName }: { defaultName: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = (formData.get("name") as string).trim();

    const result = await authClient.updateUser({ name });
    if (result.error) {
      setError(translateAuthError(result.error, MSG.SETTINGS_PROFILE_UPDATE_FAILED));
      setLoading(false);
      return;
    }

    toast.success(MSG.SETTINGS_PROFILE_UPDATED);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール</CardTitle>
        <CardDescription>表示名を変更します</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">表示名</Label>
            <Input
              id="name"
              name="name"
              defaultValue={defaultName}
              required
              minLength={1}
              maxLength={PROFILE_NAME_MAX_LENGTH}
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
          <Button type="submit" disabled={loading}>
            {loading ? "更新中..." : "更新"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UsernameSection({ defaultUsername }: { defaultUsername: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const newUsername = (formData.get("username") as string).trim();

    // Email is a one-time dummy set at signup; no need to sync on rename.
    const result = await authClient.updateUser({
      username: newUsername,
    });
    if (result.error) {
      setError(translateAuthError(result.error, MSG.SETTINGS_USERNAME_UPDATE_FAILED));
      setLoading(false);
      return;
    }

    toast.success(MSG.SETTINGS_USERNAME_UPDATED);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザー名</CardTitle>
        <CardDescription>ログインに使用するユーザー名を変更します</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">ユーザー名</Label>
            <Input
              id="username"
              name="username"
              defaultValue={defaultUsername}
              pattern="^[a-zA-Z0-9_]+$"
              title="英数字とアンダースコアのみ使用できます"
              minLength={3}
              maxLength={20}
              required
            />
            <p className="text-xs text-muted-foreground">3〜20文字、英数字とアンダースコアのみ</p>
          </div>
          {error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <Button type="submit" disabled={loading}>
            {loading ? "更新中..." : "更新"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    const { valid, errors } = validatePassword(newPassword);
    if (!valid) {
      setError(`${MSG.AUTH_PASSWORD_TOO_WEAK}: ${errors.join("、")}`);
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("新しいパスワードが一致しません");
      setLoading(false);
      return;
    }

    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    if (result.error) {
      setError(translateAuthError(result.error, MSG.SETTINGS_PASSWORD_CHANGE_FAILED));
      setLoading(false);
      return;
    }

    toast.success(MSG.SETTINGS_PASSWORD_CHANGED);
    e.currentTarget.reset();
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワード変更</CardTitle>
        <CardDescription>
          パスワードを変更すると他のセッションからログアウトされます
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">現在のパスワード</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">新しいパスワード</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              placeholder="8文字以上"
            />
            <p className="text-xs text-muted-foreground">{getPasswordRequirementsText()}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
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
          <Button type="submit" disabled={loading}>
            {loading ? "変更中..." : "パスワードを変更"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
