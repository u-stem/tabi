# SP版マイページ → プロフィールページ Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** SP版ボトムナビの「マイページ（ドロワー）」を「プロフィール（/sp/my）」ページ遷移に変更し、設定ページに「その他」タブ（FAQ・利用規約等）を追加する。

**Architecture:** 新規 `/sp/my` ページを自分専用のプロフィール+設定導線として作成する。`SpUserMenuSheet` ドロワーを廃止し、ボトムナビをドロワーからページリンクに変更。設定ページに4つ目のタブ「その他」を追加し、FAQ・利用規約等をまとめる。デスクトップ版設定ページにも同タブが追加される（サイドバー形式なのでスペース問題なし）。

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS v4, shadcn/ui, next-themes, better-auth, lucide-react

---

### Task 1: SP_ROUTES に `/my` を追加し、SP専用ルートのフォールバックを実装

**Files:**
- Modify: `apps/web/lib/view-mode.ts`

**Step 1: `SP_ROUTES` に `"/my"` を追加する**

`SP_ROUTES` 配列に `"/my"` を追加する。これにより middleware が `/my` へのアクセスを `/sp/my` にリダイレクトするようになる。

```diff
 export const SP_ROUTES = [
   "/home",
   "/bookmarks",
   "/friends",
   "/trips",
   "/settings",
   "/users",
   "/notifications",
+  "/my",
 ] as const;
```

**Step 2: SP専用ルートからデスクトップ切替時のフォールバックを追加**

`/sp/my` から「PC版で表示」を選ぶと `switchViewMode("desktop")` が `/my` に遷移しようとするが、デスクトップ版に `/my` は存在しない。`SP_ONLY_PATHS` を追加し、`/home` にフォールバックさせる。

```diff
+/** SP-only routes that have no desktop counterpart. */
+const SP_ONLY_PATHS = ["/sp/my"] as const;
+
 export async function switchViewMode(mode: ViewMode): Promise<void> {
   const maxAge = 60 * 60 * 24 * 365;

   if ("cookieStore" in window) {
     await cookieStore.set({
       name: VIEW_MODE_COOKIE,
       value: mode,
       path: "/",
       expires: Date.now() + maxAge * 1000,
       sameSite: "lax",
     });
   } else {
     document.cookie = `${VIEW_MODE_COOKIE}=${mode}; path=/; max-age=${maxAge}; SameSite=Lax`;
   }

   const { pathname, search, hash } = window.location;

   if (mode === "sp") {
     if (!pathname.startsWith(SP_PREFIX)) {
       const hasSpCounterpart = SP_ROUTES.some(
         (route) => pathname === route || pathname.startsWith(`${route}/`),
       );
       const dest = hasSpCounterpart ? `${SP_PREFIX}${pathname}` : `${SP_PREFIX}/home`;
       window.location.href = `${dest}${search}${hash}`;
     }
   } else {
     if (pathname.startsWith(SP_PREFIX)) {
-      const desktopPath = pathname.slice(SP_PREFIX.length) || "/home";
+      const isSpOnly = SP_ONLY_PATHS.some(
+        (p) => pathname === p || pathname.startsWith(`${p}/`),
+      );
+      const desktopPath = isSpOnly ? "/home" : pathname.slice(SP_PREFIX.length) || "/home";
       window.location.href = `${desktopPath}${search}${hash}`;
     }
   }
 }
```

**Step 3: 型チェック**

```bash
bun run --filter @sugara/web check-types
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add apps/web/lib/view-mode.ts
git commit -m "feat: SP_ROUTES に /my を追加し SP専用ルートのデスクトップ切替フォールバックを実装"
```

---

### Task 2: `/sp/my` ページ作成

**Files:**
- Create: `apps/web/app/(sp)/sp/my/page.tsx`

SP版レイアウト（SpHeader + SpBottomNav）は `apps/web/app/(sp)/sp/layout.tsx` が自動的に適用されるため、ページ本体のみ実装する。

**Step 1: ページファイルを作成する**

```tsx
"use client";

import {
  Check,
  ChevronRight,
  Download,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Settings,
  Sun,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { UserAvatar } from "@/components/user-avatar";
import { signOut, useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);

const THEME_OPTIONS = [
  { value: "light", label: "ライト", icon: Sun },
  { value: "dark", label: "ダーク", icon: Moon },
  { value: "system", label: "システム", icon: Monitor },
] as const;

export default function SpMyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [mounted, setMounted] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.title = pageTitle("マイページ");
  }, []);

  async function handleSignOut() {
    try {
      await signOut();
      queryClient.clear();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

  const user = session?.user;
  const displayUsername = user?.displayUsername ?? user?.username;

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-4">
      {/* Profile header */}
      <div className="flex flex-col items-center gap-3 py-6">
        <UserAvatar
          name={user?.name ?? ""}
          image={user?.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <div className="text-center">
          <h1 className="text-lg font-semibold">{user?.name}</h1>
          {displayUsername && (
            <p className="text-sm text-muted-foreground">@{displayUsername}</p>
          )}
        </div>
      </div>

      {/* Settings link */}
      <div className="overflow-hidden rounded-lg border">
        <Link
          href="/sp/settings"
          className="flex h-12 items-center gap-3 px-4 hover:bg-accent"
        >
          <Settings className="h-4 w-4" />
          <span className="flex-1">設定</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Theme toggle */}
      <div className="overflow-hidden rounded-lg border">
        <div className="px-4 py-3">
          <p className="mb-3 text-sm font-medium">テーマ</p>
          <div className="flex gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-md border px-2 py-2.5 text-xs transition-colors",
                  mounted && theme === value
                    ? "border-primary bg-primary/5 font-medium"
                    : "hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {mounted && theme === value && (
                  <Check className="h-3 w-3 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Other actions */}
      <div className="overflow-hidden rounded-lg border divide-y">
        {canInstall && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="flex h-12 w-full items-center gap-3 px-4 hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            アプリをインストール
          </button>
        )}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex h-12 w-full items-center gap-3 px-4 hover:bg-accent"
        >
          <MessageSquare className="h-4 w-4" />
          フィードバック
        </button>
        <button
          type="button"
          onClick={() => void switchViewMode("desktop")}
          className="flex h-12 w-full items-center gap-3 px-4 hover:bg-accent"
        >
          <Monitor className="h-4 w-4" />
          PC版で表示
        </button>
      </div>

      {/* Logout */}
      <div className="overflow-hidden rounded-lg border">
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="flex h-12 w-full items-center gap-3 px-4 text-destructive hover:bg-accent"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {/* Logout confirmation drawer */}
      <Drawer open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>ログアウトしますか？</DrawerTitle>
            <DrawerDescription>このデバイスからサインアウトされます。</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter className="flex-row [&>*]:flex-1">
            <DrawerClose asChild>
              <Button variant="outline">
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </DrawerClose>
            <Button variant="destructive" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              ログアウト
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
```

**Step 2: 型チェック**

```bash
bun run --filter @sugara/web check-types
```

Expected: エラーなし

**Step 3: コミット**

```bash
git add apps/web/app/(sp)/sp/my/page.tsx
git commit -m "feat: SP版マイページ (/sp/my) を新規作成"
```

---

### Task 3: SpBottomNav 更新 + SpUserMenuSheet 削除

**Files:**
- Modify: `apps/web/components/sp-bottom-nav.tsx`
- Delete: `apps/web/components/sp-user-menu-sheet.tsx`

**Step 1: `sp-bottom-nav.tsx` を更新する**

削除:
- `const [menuOpen, setMenuOpen] = useState(false);`
- `import { SpUserMenuSheet } from "@/components/sp-user-menu-sheet";`
- ファイル末尾の `<SpUserMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />`

変更（マイページ button → プロフィール Link）:

```diff
-        <button
-          type="button"
-          onClick={() => setMenuOpen(true)}
-          className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground transition-[colors,transform] active:bg-accent active:scale-[0.90]"
-          aria-label="ユーザーメニュー"
-        >
-          {mounted && session?.user ? (
-            <UserAvatar
-              name={session.user.name ?? ""}
-              image={session.user.image}
-              className="h-6 w-6"
-            />
-          ) : (
-            <User className="h-6 w-6" />
-          )}
-          <span className="text-[10px] leading-none">マイページ</span>
-        </button>
+        <Link
+          href="/sp/my"
+          className={cn(
+            "flex flex-1 flex-col items-center justify-center gap-1 transition-[colors,transform] active:bg-accent active:scale-[0.90]",
+            pathname === "/sp/my" ? "font-medium text-primary" : "text-muted-foreground",
+          )}
+          aria-label="プロフィール"
+        >
+          {mounted && session?.user ? (
+            <UserAvatar
+              name={session.user.name ?? ""}
+              image={session.user.image}
+              className="h-6 w-6"
+            />
+          ) : (
+            <User className="h-6 w-6" />
+          )}
+          <span className="text-[10px] leading-none">プロフィール</span>
+        </Link>
```

また、末尾の `<SpUserMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />` と `</>` を以下に変更:

```diff
-    <>
       <nav ...>
         ...
       </nav>
-      <SpUserMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
-    </>
+    // return 直接 <nav> のみに変更（Fragment 不要になる）
```

**Step 2: `sp-user-menu-sheet.tsx` を削除**

`SpUserMenuSheet` が他のファイルでインポートされていないことを確認:

```bash
grep -r "SpUserMenuSheet" apps/web/
```

Expected: `sp-bottom-nav.tsx` のみ（Task 3 Step 1 でインポートを削除済み）

ファイルを削除:

```bash
git rm apps/web/components/sp-user-menu-sheet.tsx
```

**Step 3: 型チェック + lint**

```bash
bun run --filter @sugara/web check-types
bun run --filter @sugara/web check
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add apps/web/components/sp-bottom-nav.tsx
git commit -m "feat: SP版ボトムナビをマイページ(ドロワー)からプロフィール(/sp/my)ページ遷移に変更"
```

---

### Task 4: 設定ページに「その他」タブを追加

**Files:**
- Modify: `apps/web/app/(authenticated)/settings/page.tsx`

**Step 1: 必要な import を追加**

`lucide-react` の import に `FileText, HelpCircle, MessageSquare, MoreHorizontal, Newspaper, Shield` を追加。

ファイル先頭に dynamic import を追加:

```tsx
const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);
```

`dynamic` は既に `next/dynamic` でインポートされているか確認する。現在の設定ページは `dynamic` を使っていない。`import dynamic from "next/dynamic";` を追加する。

**Step 2: `Section` 型・`SECTIONS`・`NAV_ITEMS` を更新**

```diff
-type Section = "profile" | "notifications" | "account";
-const SECTIONS = ["profile", "notifications", "account"] as const satisfies readonly Section[];
-const NAV_ITEMS: { id: Section; label: string; Icon: React.ElementType }[] = [
-  { id: "profile", label: "プロフィール", Icon: User },
-  { id: "notifications", label: "通知", Icon: Bell },
-  { id: "account", label: "アカウント", Icon: Settings2 },
-];
+type Section = "profile" | "notifications" | "account" | "other";
+const SECTIONS = ["profile", "notifications", "account", "other"] as const satisfies readonly Section[];
+const NAV_ITEMS: { id: Section; label: string; Icon: React.ElementType }[] = [
+  { id: "profile", label: "プロフィール", Icon: User },
+  { id: "notifications", label: "通知", Icon: Bell },
+  { id: "account", label: "アカウント", Icon: Settings2 },
+  { id: "other", label: "その他", Icon: MoreHorizontal },
+];
```

**Step 3: `renderSectionContent` に `case "other"` を追加**

```diff
 function renderSectionContent(s: Section) {
   switch (s) {
     case "profile":
       if (!user) return null;
       return <ProfileSection ... />;
     case "notifications":
       return <NotificationPreferencesSection />;
     case "account":
       if (!user) return null;
       return (
         <>
           ...
         </>
       );
+    case "other":
+      return <OtherSection />;
   }
 }
```

**Step 4: `OtherSection` コンポーネントをファイル末尾に追加**

```tsx
function OtherSection() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <div className="overflow-hidden rounded-lg border divide-y">
        <a
          href="/faq"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center gap-3 px-4 hover:bg-accent"
        >
          <HelpCircle className="h-4 w-4" />
          よくある質問
        </a>
        <a
          href="/news"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center gap-3 px-4 hover:bg-accent"
        >
          <Newspaper className="h-4 w-4" />
          お知らせ
        </a>
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex h-12 w-full items-center gap-3 px-4 hover:bg-accent"
        >
          <MessageSquare className="h-4 w-4" />
          フィードバック
        </button>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center gap-3 px-4 hover:bg-accent"
        >
          <FileText className="h-4 w-4" />
          利用規約
        </a>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center gap-3 px-4 hover:bg-accent"
        >
          <Shield className="h-4 w-4" />
          プライバシーポリシー
        </a>
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
```

**Step 5: モバイルタブグリッドを `grid-cols-4` に変更し、テキストサイズを調整**

「プロフィール」（6文字）が4カラムに収まるよう、モバイルでは `text-[11px]` と `px-1` を使用する。`md:` 以上では現在の `text-sm px-3` を維持する。

```diff
         <div
           role="tablist"
           aria-orientation="horizontal"
-          className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 md:flex md:flex-col md:grid-cols-none md:w-48 md:shrink-0 md:rounded-none md:bg-transparent md:p-0"
+          className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 md:flex md:flex-col md:grid-cols-none md:w-48 md:shrink-0 md:rounded-none md:bg-transparent md:p-0"
         >
           {NAV_ITEMS.map(({ id, label, Icon }) => (
             <button
               key={id}
               type="button"
               role="tab"
               aria-selected={section === id}
               onClick={() => changeSection(id)}
               className={cn(
-                "min-h-[36px] rounded-md px-2 py-1.5 text-sm font-medium transition-[colors,transform] active:scale-[0.97]",
+                "min-h-[36px] rounded-md px-1 py-1.5 text-[11px] font-medium transition-[colors,transform] active:scale-[0.97]",
                 "flex items-center justify-center",
-                "md:justify-start md:gap-2 md:px-3 md:py-2 md:whitespace-nowrap md:active:scale-100",
+                "md:justify-start md:gap-2 md:px-3 md:py-2 md:text-sm md:whitespace-nowrap md:active:scale-100",
                 section === id
                   ? "bg-background text-foreground shadow-sm md:bg-muted md:shadow-none"
                   : "text-muted-foreground hover:text-foreground md:hover:bg-muted/50",
               )}
             >
```

**Step 6: 型チェック + lint**

```bash
bun run --filter @sugara/web check-types
bun run --filter @sugara/web check
```

Expected: エラーなし

**Step 7: コミット**

```bash
git add apps/web/app/(authenticated)/settings/page.tsx
git commit -m "feat: 設定ページに「その他」タブ（FAQ・お知らせ・利用規約等）を追加"
```

---

### Task 5: 全体テスト・検証

**Step 1: テスト実行**

```bash
bun run --filter @sugara/web test --run
```

Expected: 全テスト通過

**Step 2: 型チェック・lint**

```bash
bun run --filter @sugara/web check-types
bun run --filter @sugara/web check
```

Expected: エラーなし

**Step 3: 手動検証チェックリスト**

- [ ] SP版ボトムナビ「プロフィール」タップ → `/sp/my` に遷移
- [ ] `/sp/my` ページにアバター・名前・@username が表示される
- [ ] 設定リンク → `/sp/settings` に遷移
- [ ] テーマ切替（ライト/ダーク/システム）が動作する
- [ ] フィードバックボタン → FeedbackDialog が開く
- [ ] PC版で表示 → デスクトップ版 `/home` にリダイレクト（`/sp/my` でないことを確認）
- [ ] ログアウトボタン → 確認ドロワーが開き、ログアウトできる
- [ ] `/sp/settings` → 4タブ（プロフィール/通知/アカウント/その他）が表示される
- [ ] 設定「その他」タブ → FAQ・お知らせ・利用規約・プライバシーポリシーリンク + フィードバック
- [ ] 設定タブのスワイプ操作が4タブ間で動作する
- [ ] デスクトップ版 `/settings` → サイドバーに「その他」が追加されている
- [ ] `SpUserMenuSheet` が削除され、import エラーがないことを確認

**Step 4: 最終コミット（必要に応じて）**

全て通過していれば追加コミット不要。

---

## Files Summary

| File | Action |
|------|--------|
| `apps/web/lib/view-mode.ts` | SP_ROUTES に `/my` 追加、SP専用ルートのデスクトップフォールバック追加 |
| `apps/web/app/(sp)/sp/my/page.tsx` | 新規作成（プロフィール・テーマ・設定導線・ログアウト） |
| `apps/web/components/sp-bottom-nav.tsx` | マイページ button → プロフィール Link(/sp/my) に変更、SpUserMenuSheet 削除 |
| `apps/web/components/sp-user-menu-sheet.tsx` | 削除 |
| `apps/web/app/(authenticated)/settings/page.tsx` | 「その他」タブ追加、grid-cols-4 対応 |
