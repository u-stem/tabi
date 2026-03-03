# User Menu UX Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** SP版のユーザーメニューをボトムナビのアカウントタブ + ボトムシートに移行し、デスクトップ版のドロップダウンの余白とユーザー情報ヘッダーを改善する。

**Architecture:** SP版は `SpUserMenuSheet` コンポーネントを新規作成し、既存の SpHeader から Sheet ロジックを移管する。SpBottomNav にアバタータブを追加してシートのトリガーとする。デスクトップ版は `header.tsx` の `DropdownMenuContent` と `DropdownMenuLabel` 部分を変更する。

**Tech Stack:** Next.js 15, React 19, shadcn/ui (Sheet, DropdownMenu), Tailwind CSS v4, Vitest + React Testing Library

---

### Task 1: `SpUserMenuSheet` コンポーネントを作成する

**Files:**
- Create: `apps/web/components/sp-user-menu-sheet.tsx`
- Test: `apps/web/lib/__tests__/sp-user-menu-sheet.test.tsx`

既存の `SpHeader` にある Sheet の中身（メニューアイテム + FeedbackDialog）をそのまま移管し、`side="bottom"` に変更した新コンポーネントを作る。

**Step 1: テストを書く**

```tsx
// apps/web/lib/__tests__/sp-user-menu-sheet.test.tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpUserMenuSheet } from "../../components/sp-user-menu-sheet";

vi.mock("../../lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: { name: "Test User", username: "testuser", displayUsername: null, image: null },
    },
  }),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/sp/home",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("../../lib/hooks/use-install-prompt", () => ({
  useInstallPrompt: () => ({ canInstall: false, promptInstall: vi.fn() }),
}));

describe("SpUserMenuSheet", () => {
  afterEach(cleanup);

  it("open=true のとき設定リンクが見える", () => {
    render(<SpUserMenuSheet open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: /設定/ })).toBeDefined();
  });

  it("onOpenChange(false) がログアウト以外のリンクのクリックで呼ばれる", () => {
    const onOpenChange = vi.fn();
    render(<SpUserMenuSheet open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("link", { name: /設定/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("open=false のときコンテンツが描画されない", () => {
    render(<SpUserMenuSheet open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /設定/ })).toBeNull();
  });
});
```

**Step 2: テストを実行して失敗を確認する**

```bash
bun run --filter @sugara/web test --run lib/__tests__/sp-user-menu-sheet.test.tsx
```

Expected: `SpUserMenuSheet` が存在しないため FAIL

**Step 3: コンポーネントを実装する**

`apps/web/components/sp-header.tsx` から以下をコピーして `sp-user-menu-sheet.tsx` を作成する。

```tsx
// apps/web/components/sp-user-menu-sheet.tsx
"use client";

import {
  Download,
  FileText,
  HelpCircle,
  LogOut,
  MessageSquare,
  Monitor,
  Newspaper,
  Settings,
  Shield,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOut, useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SpUserMenuSheet({ open, onOpenChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const isGuest = isGuestUser(session);

  async function handleSignOut() {
    try {
      await signOut();
      queryClient.clear();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle className="truncate">{session?.user?.name}</SheetTitle>
            <SheetDescription>
              {session?.user?.displayUsername
                ? `@${session.user.displayUsername}`
                : session?.user?.username
                  ? `@${session.user.username}`
                  : ""}
            </SheetDescription>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1" aria-label="モバイルメニュー">
            {!isGuest && (
              <Link
                href="/sp/settings"
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  pathname === "/sp/settings"
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Settings className="h-4 w-4" />
                設定
              </Link>
            )}
            <button
              type="button"
              onClick={() => {
                setFeedbackOpen(true);
                onOpenChange(false);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              フィードバック
            </button>
            {canInstall && (
              <button
                type="button"
                onClick={() => {
                  promptInstall();
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Download className="h-4 w-4" />
                アプリをインストール
              </button>
            )}
            <div className="my-2 border-t" />
            <Link
              href="/faq"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
              よくある質問
            </Link>
            <Link
              href="/news"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Newspaper className="h-4 w-4" />
              お知らせ
            </Link>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <FileText className="h-4 w-4" />
              利用規約
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Shield className="h-4 w-4" />
              プライバシーポリシー
            </Link>
            <div className="my-2 border-t" />
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                void switchViewMode("desktop");
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <Monitor className="h-4 w-4" />
              PC版で表示
            </button>
            <button
              type="button"
              onClick={() => {
                handleSignOut();
                onOpenChange(false);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              ログアウト
            </button>
          </nav>
        </SheetContent>
      </Sheet>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
```

**Step 4: テストを実行してパスを確認する**

```bash
bun run --filter @sugara/web test --run lib/__tests__/sp-user-menu-sheet.test.tsx
```

Expected: 3 tests PASS

**Step 5: コミット**

```bash
git add apps/web/components/sp-user-menu-sheet.tsx apps/web/lib/__tests__/sp-user-menu-sheet.test.tsx
git commit -m "feat: SpUserMenuSheet コンポーネントを作成（ボトムシート）"
```

---

### Task 2: `SpBottomNav` にアカウントタブを追加する

**Files:**
- Modify: `apps/web/components/sp-bottom-nav.tsx`

BottomNavBase を使い続けつつ、その外側に UserAvatar トリガーボタン + SpUserMenuSheet を追加する。BottomNavBase 自体は変更しない。

**Step 1: `SpBottomNav` を以下の実装に書き換える**

現在は `BottomNavBase` をそのまま返すだけだが、アカウントタブを追加するために直接ナビゲーションを実装する。

```tsx
// apps/web/components/sp-bottom-nav.tsx
"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SpUserMenuSheet } from "@/components/sp-user-menu-sheet";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { SP_NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export function SpBottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const isGuest = isGuestUser(session);

  const { data: friendRequests } = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
    enabled: !!session?.user && !isGuest,
    refetchInterval: 60_000,
    retry: false,
  });
  const friendRequestCount = friendRequests?.length ?? 0;

  const friendHref = "/sp/friends";
  const bookmarkHref = "/sp/bookmarks";
  const visibleLinks = SP_NAV_LINKS.filter(
    (link) => !isGuest || (link.href !== bookmarkHref && link.href !== friendHref),
  );

  return (
    <>
      <nav
        aria-label="ボトムナビゲーション"
        className="fixed inset-x-0 bottom-0 z-40 select-none border-t bg-background print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-12 items-stretch">
          {visibleLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-[colors,transform] active:bg-accent active:scale-[0.90]",
                  active ? "font-medium text-primary" : "text-muted-foreground",
                )}
              >
                <link.icon className="h-5 w-5" />
                <span className="sr-only">{link.label}</span>
                {link.href === friendHref && friendRequestCount > 0 && (
                  <span className="absolute top-1.5 left-1/2 ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium tabular-nums text-destructive-foreground">
                    {friendRequestCount}
                  </span>
                )}
              </Link>
            );
          })}
          {/* Account tab: always rendered to keep layout stable, content conditional on session */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground transition-[colors,transform] active:bg-accent active:scale-[0.90]"
            aria-label="ユーザーメニュー"
          >
            {mounted && session?.user ? (
              <UserAvatar
                name={session.user.name ?? ""}
                image={session.user.image}
                className="h-5 w-5"
              />
            ) : (
              <User className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>
      <SpUserMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
```

**Step 2: 型チェックを実行する**

```bash
bun run --filter @sugara/web check-types
```

Expected: エラーなし

**Step 3: コミット**

```bash
git add apps/web/components/sp-bottom-nav.tsx
git commit -m "feat: SpBottomNav にアカウントタブを追加"
```

---

### Task 3: `SpHeader` からアバターボタンと Sheet を削除する

**Files:**
- Modify: `apps/web/components/sp-header.tsx`

SpUserMenuSheet に移管済みのロジックを SpHeader から削除する。削除対象:
- `mobileMenuOpen` state
- `feedbackOpen` state
- `handleSignOut` 関数
- `FeedbackDialog` import + render
- `Sheet*` imports + render
- アバター `Button` render
- 不要になった imports（useRouter, useQueryClient, signOut, useInstallPrompt, isGuestUser, MSG, switchViewMode, Sheet*, FeedbackDialog, アイコン群）

**Step 1: `SpHeader` を書き換える**

```tsx
// apps/web/components/sp-header.tsx
"use client";

import { useEffect, useState } from "react";
import { GuestBanner } from "@/components/guest-banner";
import { InstallBanner } from "@/components/install-banner";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";

/**
 * SP-specific header: simplified for mobile.
 * Navigation is handled by SpBottomNav (including the account menu trigger),
 * so this header only has the logo, theme toggle, and notification bell.
 */
export function SpHeader() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  // Prevent hydration mismatch: better-auth may return cached session synchronously
  // on the client while the server always starts with null.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 select-none border-b bg-background">
      <OfflineBanner />
      <GuestBanner />
      <InstallBanner />
      <nav
        aria-label="メインナビゲーション"
        className="container flex h-14 items-center justify-between"
      >
        <Logo href="/sp/home" />
        <div className="flex items-center gap-1">
          {mounted && session?.user && !isGuest && <NotificationBell />}
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
```

**Step 2: 型チェックと lint を実行する**

```bash
bun run --filter @sugara/web check-types
bun run --filter @sugara/web check
```

Expected: エラーなし（UserAvatar import が不要になる場合は削除済みであること）

**Step 3: コミット**

```bash
git add apps/web/components/sp-header.tsx
git commit -m "refactor: SpHeader からユーザーメニューを削除（SpBottomNav に移管）"
```

---

### Task 4: デスクトップ `DropdownMenu` のサイズとユーザー情報ヘッダーを改善する

**Files:**
- Modify: `apps/web/components/header.tsx`

**変更点:**
1. `DropdownMenuContent` に `className="w-56"` を追加（メニュー幅を 128px → 224px に拡大）
2. `DropdownMenuLabel` + `DropdownMenuSeparator` を UserAvatar 付きのリッチなヘッダーに置き換え
3. 各 `DropdownMenuItem` に `className="py-2"` を追加（上下パディングを 6px → 8px に拡大）

**Step 1: `DropdownMenuContent` の幅を変更する**

`header.tsx` 内の `<DropdownMenuContent align="end">` を以下に変更:

```tsx
<DropdownMenuContent align="end" className="w-56">
```

**Step 2: ユーザー情報ヘッダーを置き換える**

以下の部分を:

```tsx
<DropdownMenuLabel className="truncate">{session.user.name}</DropdownMenuLabel>
<DropdownMenuSeparator />
```

以下に置き換える:

```tsx
<div className="flex items-center gap-3 px-2 py-2">
  <UserAvatar
    name={session.user.name ?? ""}
    image={session.user.image}
    className="h-9 w-9 shrink-0"
  />
  <div className="min-w-0">
    <p className="truncate text-sm font-medium leading-none">{session.user.name}</p>
    <p className="mt-1 truncate text-xs text-muted-foreground">
      {session.user.displayUsername
        ? `@${session.user.displayUsername}`
        : session.user.username
          ? `@${session.user.username}`
          : ""}
    </p>
  </div>
</div>
<DropdownMenuSeparator />
```

**Step 3: 各 DropdownMenuItem にパディングを追加する**

`header.tsx` 内のすべての `<DropdownMenuItem` に `className="py-2"` を追加する（既存の asChild や onClick は維持）。

例:
```tsx
<DropdownMenuItem asChild className="py-2">
  <Link href={`/users/${session.user.id}`}>
    ...
  </Link>
</DropdownMenuItem>
```

**Step 4: 型チェックと lint を実行する**

```bash
bun run --filter @sugara/web check-types
bun run --filter @sugara/web check
```

Expected: エラーなし

**Step 5: コミット**

```bash
git add apps/web/components/header.tsx
git commit -m "feat: デスクトップのユーザーメニューの余白とユーザー情報ヘッダーを改善"
```

---

### Task 5: 動作確認

**Step 1: 開発サーバーを起動する**

```bash
bun run --filter @sugara/web dev
```

**Step 2: SP版を確認する（ブラウザのモバイルエミュレーターを使用）**

- ボトムナビの右端にアバターアイコンが表示されている
- タップするとボトムシートが下から開く
- ヘッダーにはロゴ + 通知ベル + テーマ切替のみ（アバターボタンなし）
- シート内の設定・ログアウト等のリンクが機能する

**Step 3: デスクトップ版を確認する**

- 右上アバターをクリックするとドロップダウンが開く
- メニュー幅が広がっている（約 224px）
- ユーザー名の上にアバター画像と名前・ユーザーネームが表示される
- 各メニュー項目の上下余白が増えている

**Step 4: 全テストを実行する**

```bash
bun run test
```

Expected: all PASS
