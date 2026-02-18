"use client";

import { buildDiceBearUrl, DICEBEAR_STYLES, type DiceBearStyle } from "@sugara/shared";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, api } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-error";
import { copyToClipboard } from "@/lib/clipboard";
import {
  getPasswordRequirementsText,
  MIN_PASSWORD_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  pageTitle,
  validatePassword,
} from "@/lib/constants";
import { MSG } from "@/lib/messages";

export default function SettingsPage() {
  const { data: session } = useSession();

  useEffect(() => {
    document.title = pageTitle("設定");
  }, []);

  const user = session?.user;

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-8">
      {user && (
        <>
          <UserIdSection userId={user.id} />
          <AvatarSection name={user.name ?? ""} currentImage={user.image ?? null} />
          <ProfileSection defaultName={user.name ?? ""} />
          <UsernameSection defaultUsername={user.displayUsername ?? user.username ?? ""} />
          <PasswordSection username={user.username ?? ""} />
          <DeleteAccountSection username={user.username ?? ""} />
          <div className="flex flex-wrap select-none items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link
              href="/faq"
              target="_blank"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              よくある質問
              <ExternalLink className="h-3 w-3" />
            </Link>
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
            <p className="text-right text-xs text-muted-foreground">
              {name.length}/{PROFILE_NAME_MAX_LENGTH}
            </p>
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
            <p className="select-none text-xs text-muted-foreground">
              3〜20文字、英数字とアンダースコアのみ
            </p>
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
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="select-none text-xs text-muted-foreground">
              {getPasswordRequirementsText()}
            </p>
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

const STYLE_LABELS: Record<DiceBearStyle, string> = {
  glass: "Glass",
  identicon: "Identicon",
  rings: "Rings",
  shapes: "Shapes",
  thumbs: "Thumbs",
  lorelei: "Lorelei",
  "lorelei-neutral": "Lorelei Neutral",
  notionists: "Notionists",
  "notionists-neutral": "Notionists Neutral",
  "open-peeps": "Open Peeps",
  "pixel-art": "Pixel Art",
  "pixel-art-neutral": "Pixel Art Neutral",
};

const CANDIDATE_COUNT = 6;

function generateSeeds(count: number): string[] {
  return Array.from({ length: count }, () => crypto.randomUUID().slice(0, 8));
}

function AvatarSection({ name, currentImage }: { name: string; currentImage: string | null }) {
  const { refetch } = useSession();
  const [style, setStyle] = useState<DiceBearStyle>("glass");
  const [seeds, setSeeds] = useState<string[]>(() => generateSeeds(CANDIDATE_COUNT));
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const shuffle = useCallback(() => {
    setSeeds(generateSeeds(CANDIDATE_COUNT));
    setSelected(null);
  }, []);

  async function refreshSession() {
    // Bypass cookie cache to get fresh user data from DB
    await refetch({ query: { disableCookieCache: true } });
  }

  async function handleSave() {
    if (!selected) return;
    setLoading(true);
    try {
      const image = buildDiceBearUrl(style, selected);
      const result = await authClient.updateUser({ image });
      if (result.error) {
        toast.error(MSG.SETTINGS_AVATAR_UPDATE_FAILED);
        return;
      }
      await refreshSession();
      toast.success(MSG.SETTINGS_AVATAR_UPDATED);
      setSelected(null);
    } catch {
      toast.error(MSG.SETTINGS_AVATAR_UPDATE_FAILED);
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    setLoading(true);
    try {
      const result = await authClient.updateUser({ image: null });
      if (result.error) {
        toast.error(MSG.SETTINGS_AVATAR_UPDATE_FAILED);
        return;
      }
      await refreshSession();
      toast.success(MSG.SETTINGS_AVATAR_RESET);
      setSelected(null);
    } catch {
      toast.error(MSG.SETTINGS_AVATAR_UPDATE_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>アバター</CardTitle>
        <CardDescription>プロフィールに表示されるアバターを設定します</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <UserAvatar name={name} image={currentImage} className="h-16 w-16" />
          <div className="text-sm text-muted-foreground">
            {currentImage ? "カスタムアバターを設定中" : "デフォルト（イニシャル）"}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar-style">スタイル</Label>
          <Select
            value={style}
            onValueChange={(v) => {
              setStyle(v as DiceBearStyle);
              setSelected(null);
            }}
          >
            <SelectTrigger id="avatar-style" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DICEBEAR_STYLES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STYLE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {seeds.map((seed) => {
            const url = buildDiceBearUrl(style, seed);
            const isSelected = selected === seed;
            return (
              <button
                key={seed}
                type="button"
                onClick={() => setSelected(isSelected ? null : seed)}
                className={`flex items-center justify-center rounded-lg border-2 p-2 transition-colors ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-transparent hover:border-border"
                }`}
              >
                <img
                  src={url}
                  alt={`${STYLE_LABELS[style]} avatar ${seed}`}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={shuffle}>
            <RefreshCw className="h-4 w-4" />
            シャッフル
          </Button>
          <Button type="button" size="sm" disabled={!selected || loading} onClick={handleSave}>
            {loading ? "設定中..." : "設定する"}
          </Button>
          {currentImage && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={handleReset}
            >
              リセット
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeleteAccountSection({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  async function handleDelete() {
    setError(null);
    setLoading(true);

    try {
      await api("/api/account", {
        method: "DELETE",
        body: JSON.stringify({ password }),
      });
      toast.success(MSG.ACCOUNT_DELETED);
      // Clear session cookie before redirect to prevent cookieCache from keeping the user logged in
      try {
        await authClient.signOut();
      } catch {
        // Session may already be invalidated by CASCADE delete
      }
      window.location.href = "/auth/login";
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("パスワードが正しくありません");
      } else {
        setError(MSG.ACCOUNT_DELETE_FAILED);
      }
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setPassword("");
      setError(null);
    }
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle>アカウント削除</CardTitle>
        <CardDescription>
          アカウントと全てのデータが完全に削除されます。この操作は取り消せません。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">アカウントを削除</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>本当にアカウントを削除しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                全ての旅行、メンバーシップ、フレンド情報が完全に削除されます。この操作は元に戻せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <input type="hidden" name="username" autoComplete="username" value={username} />
              <Label htmlFor="deletePassword">パスワードを入力して確認</Label>
              <Input
                id="deletePassword"
                name="deletePassword"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>キャンセル</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={loading || password.length === 0}
                onClick={handleDelete}
              >
                {loading ? "削除中..." : "削除する"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
