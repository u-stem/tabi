"use client";

import { buildDiceBearUrl, DICEBEAR_STYLES, type DiceBearStyle } from "@sugara/shared";
import { Bell, ExternalLink, RefreshCw, Settings2, User, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { EmailSection } from "@/components/email-section";
import { NotificationPreferencesSection } from "@/components/notification-preferences-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogTrigger,
} from "@/components/ui/responsive-alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, api } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";
import { translateAuthError } from "@/lib/auth-error";
import {
  getPasswordRequirementsText,
  MIN_PASSWORD_LENGTH,
  PROFILE_NAME_MAX_LENGTH,
  pageTitle,
  validatePassword,
} from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useSwipeTab } from "@/lib/hooks/use-swipe-tab";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

type Section = "profile" | "notifications" | "account";

const SECTIONS = ["profile", "notifications", "account"] as const satisfies readonly Section[];

const NAV_ITEMS: { id: Section; label: string; Icon: React.ElementType }[] = [
  { id: "profile", label: "プロフィール", Icon: User },
  { id: "notifications", label: "通知", Icon: Bell },
  { id: "account", label: "アカウント", Icon: Settings2 },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  const [section, setSection] = useState<Section>("profile");
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionRef = useRef<Section>("profile");
  const contentRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = pageTitle("設定");
  }, []);

  useEffect(() => {
    if (searchParams.get("emailVerified") === "1") {
      toast.success("メールアドレスを設定しました。");
      router.replace("/settings");
    }
  }, [searchParams, router]);

  const user = session?.user;
  const currentSectionIdx = SECTIONS.indexOf(section);

  const changeSection = useCallback((s: Section) => {
    sectionRef.current = s;
    setSection(s);
  }, []);

  const handleSwipe = useCallback(
    (direction: "left" | "right") => {
      const idx = SECTIONS.indexOf(sectionRef.current);
      const nextIdx = direction === "left" ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= SECTIONS.length) return;
      changeSection(SECTIONS[nextIdx]);
    },
    [changeSection],
  );

  const swipe = useSwipeTab(contentRef, swipeRef, {
    onSwipeComplete: handleSwipe,
    canSwipePrev: currentSectionIdx > 0,
    canSwipeNext: currentSectionIdx < SECTIONS.length - 1,
    enabled: !isGuest && !!user,
  });

  const adjacentSection =
    swipe.adjacent === "next"
      ? SECTIONS[currentSectionIdx + 1]
      : swipe.adjacent === "prev"
        ? SECTIONS[currentSectionIdx - 1]
        : undefined;

  function renderSectionContent(s: Section) {
    switch (s) {
      case "profile":
        if (!user) return null;
        return <ProfileSection name={user.name ?? ""} currentImage={user.image ?? null} />;
      case "notifications":
        return <NotificationPreferencesSection />;
      case "account":
        if (!user) return null;
        return (
          <>
            <EmailSection
              currentEmail={user.email ?? ""}
              emailVerified={user.emailVerified ?? false}
            />
            <UsernameSection defaultUsername={user.displayUsername ?? user.username ?? ""} />
            <PasswordSection username={user.username ?? ""} />
            <DeleteAccountSection username={user.username ?? ""} />
          </>
        );
    }
  }

  if (isGuest) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{MSG.AUTH_GUEST_FEATURE_UNAVAILABLE}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 mx-auto max-w-4xl">
      <div className="flex flex-col gap-6 md:flex-row md:gap-10">
        {/* Tab nav — pill grid on mobile, sidebar on desktop */}
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 md:flex md:flex-col md:grid-cols-none md:w-48 md:shrink-0 md:rounded-none md:bg-transparent md:p-0"
        >
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={section === id}
              onClick={() => changeSection(id)}
              className={cn(
                "min-h-[36px] rounded-md px-2 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.97]",
                "flex items-center justify-center",
                "md:justify-start md:gap-2 md:px-3 md:py-2 md:whitespace-nowrap md:active:scale-100",
                section === id
                  ? "bg-background text-foreground shadow-sm md:bg-muted md:shadow-none"
                  : "text-muted-foreground hover:text-foreground md:hover:bg-muted/50",
              )}
            >
              <Icon className="hidden md:block h-4 w-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-8">
          {/* Swipe container — px-0.5/-mx-0.5 lets focus rings bleed past the overflow boundary */}
          <div ref={contentRef} className="overflow-x-hidden touch-pan-y -mx-0.5 px-0.5">
            <div
              ref={swipeRef}
              className="relative touch-pan-y"
              style={{ willChange: swipe.adjacent ? "transform" : "auto" }}
            >
              <div className="space-y-8">{renderSectionContent(section)}</div>

              {swipe.adjacent && adjacentSection && (
                <div
                  className="absolute top-0 left-0 w-full space-y-8"
                  aria-hidden="true"
                  style={{
                    transform: swipe.adjacent === "next" ? "translateX(100%)" : "translateX(-100%)",
                  }}
                >
                  {renderSectionContent(adjacentSection)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap select-none items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <Link
              href="/faq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              よくある質問
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/news"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              お知らせ
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              利用規約
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-foreground"
            >
              プライバシーポリシー
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({
  name: defaultName,
  currentImage,
}: {
  name: string;
  currentImage: string | null;
}) {
  const { refetch } = useSession();
  const [style, setStyle] = useState<DiceBearStyle>("glass");
  const [seeds, setSeeds] = useState<string[]>(() => generateSeeds(CANDIDATE_COUNT));
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null);
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarChanged = selectedSeed !== null;
  const nameChanged = name.trim() !== defaultName;
  const dirty = avatarChanged || nameChanged;

  const shuffle = useCallback(() => {
    setSeeds(generateSeeds(CANDIDATE_COUNT));
    setSelectedSeed(null);
  }, []);

  async function refreshSession() {
    await refetch({ query: { disableCookieCache: true } });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const updates: { name?: string; image?: string } = {};
    if (nameChanged) updates.name = name.trim();
    if (avatarChanged && selectedSeed) updates.image = buildDiceBearUrl(style, selectedSeed);

    const result = await authClient.updateUser(updates);
    if (result.error) {
      setError(translateAuthError(result.error, MSG.SETTINGS_PROFILE_UPDATE_FAILED));
      setLoading(false);
      return;
    }

    await refreshSession();
    toast.success(MSG.SETTINGS_PROFILE_UPDATED);
    setSelectedSeed(null);
    setLoading(false);
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
      setSelectedSeed(null);
    } catch {
      toast.error(MSG.SETTINGS_AVATAR_UPDATE_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>プロフィール</CardTitle>
        <CardDescription>アバターと表示名を変更します</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar name={defaultName} image={currentImage} className="h-16 w-16" />
              <div className="text-sm text-muted-foreground">
                {currentImage ? "カスタムアバターを設定中" : "デフォルト（イニシャル）"}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar-style">スタイル</Label>
              <div className="flex gap-2">
                <Select
                  value={style}
                  onValueChange={(v) => {
                    setStyle(v as DiceBearStyle);
                    setSelectedSeed(null);
                  }}
                >
                  <SelectTrigger id="avatar-style" className="flex-1">
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
                <Button type="button" variant="outline" onClick={shuffle} className="shrink-0">
                  <RefreshCw className="h-4 w-4" />
                  シャッフル
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {seeds.map((seed) => {
                const url = buildDiceBearUrl(style, seed);
                const isSelected = selectedSeed === seed;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => setSelectedSeed(isSelected ? null : seed)}
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
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              表示名 <span className="text-destructive">*</span>
            </Label>
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

          <div className="flex justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading || !currentImage}
                    onClick={handleReset}
                  >
                    アバターをリセット
                  </Button>
                </span>
              </TooltipTrigger>
              {!currentImage && !loading && (
                <TooltipContent>カスタムアバターが設定されていません</TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button type="submit" disabled={loading || !dirty}>
                    {loading ? "保存中..." : "保存"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!dirty && !loading && <TooltipContent>{MSG.NO_CHANGES}</TooltipContent>}
            </Tooltip>
          </div>
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
            <Label htmlFor="username">
              ユーザー名 <span className="text-destructive">*</span>
            </Label>
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
          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button type="submit" disabled={loading || !dirty}>
                    {loading ? "更新中..." : "更新"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!dirty && !loading && <TooltipContent>{MSG.NO_CHANGES}</TooltipContent>}
            </Tooltip>
          </div>
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
      setError(MSG.AUTH_PASSWORD_MISMATCH);
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
            <Label htmlFor="currentPassword">
              現在のパスワード <span className="text-destructive">*</span>
            </Label>
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
            <Label htmlFor="newPassword">
              新しいパスワード <span className="text-destructive">*</span>
            </Label>
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
            <Label htmlFor="confirmPassword">
              新しいパスワード（確認） <span className="text-destructive">*</span>
            </Label>
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
          <div className="flex justify-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button type="submit" disabled={loading || !filled}>
                    {loading ? "変更中..." : "パスワードを変更"}
                  </Button>
                </span>
              </TooltipTrigger>
              {!filled && !loading && (
                <TooltipContent>パスワードをすべて入力してください</TooltipContent>
              )}
            </Tooltip>
          </div>
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
        <ResponsiveAlertDialog open={open} onOpenChange={handleOpenChange}>
          <div className="flex justify-end">
            <ResponsiveAlertDialogTrigger asChild>
              <Button variant="destructive">アカウントを削除</Button>
            </ResponsiveAlertDialogTrigger>
          </div>
          <ResponsiveAlertDialogContent>
            <ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogTitle>
                本当にアカウントを削除しますか？
              </ResponsiveAlertDialogTitle>
              <ResponsiveAlertDialogDescription>
                全ての旅行、メンバーシップ、フレンド情報が完全に削除されます。この操作は元に戻せません。
              </ResponsiveAlertDialogDescription>
            </ResponsiveAlertDialogHeader>
            <div className="space-y-2">
              <input type="hidden" name="username" autoComplete="username" value={username} />
              <Label htmlFor="deletePassword">
                パスワードを入力して確認 <span className="text-destructive">*</span>
              </Label>
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
            <ResponsiveAlertDialogFooter>
              <ResponsiveAlertDialogCancel disabled={loading}>
                <X className="h-4 w-4" />
                キャンセル
              </ResponsiveAlertDialogCancel>
              <Button
                variant="destructive"
                disabled={loading || password.length === 0}
                onClick={handleDelete}
              >
                {loading ? "削除中..." : "削除する"}
              </Button>
            </ResponsiveAlertDialogFooter>
          </ResponsiveAlertDialogContent>
        </ResponsiveAlertDialog>
      </CardContent>
    </Card>
  );
}
