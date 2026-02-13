"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-error";
import { copyToClipboard } from "@/lib/clipboard";
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
          <PasswordSection username={user.username ?? ""} />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link
              href="/news"
              target="_blank"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              お知らせ
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/terms"
              target="_blank"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              利用規約
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              プライバシーポリシー
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function UserIdSection({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(userId);
    setCopied(true);
    toast.success(MSG.SETTINGS_USER_ID_COPIED);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザーID</CardTitle>
        <CardDescription>フレンド申請やメンバー追加時にこのIDを共有してください</CardDescription>
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
  const [name, setName] = useState(defaultName);
  const dirty = name.trim() !== defaultName;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = name.trim();
    const result = await authClient.updateUser({ name: trimmed });
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
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          <Button type="submit" disabled={loading || !dirty}>
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
  const [username, setUsername] = useState(defaultUsername);
  const dirty = username.trim() !== defaultUsername;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = username.trim();
    // Email is a one-time dummy set at signup; no need to sync on rename.
    const result = await authClient.updateUser({
      username: trimmed,
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
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
          <Button type="submit" disabled={loading || !dirty}>
            {loading ? "更新中..." : "更新"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordSection({ username }: { username: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const filled = currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

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
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
          <input type="hidden" name="username" autoComplete="username" value={username} />
          <div className="space-y-2">
            <Label htmlFor="currentPassword">現在のパスワード</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
          <Button type="submit" disabled={loading || !filled}>
            {loading ? "変更中..." : "パスワードを変更"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
