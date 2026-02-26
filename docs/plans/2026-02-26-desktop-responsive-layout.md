# Desktop Responsive Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** デスクトップ版レイアウトをレスポンシブ化する（SP版へのリダイレクトなし・デスクトップUIを維持したまま狭い幅でも崩れないようにする）

**Architecture:** `min-w-[1024px]` + `overflow-x-auto` を廃止し、ヘッダーに md ブレークポイント対応のハンバーガーメニューを追加。各ページのグリッドを viewport ベースのブレークポイントで正しく機能させる。Trip 詳細の `lg:hidden` / `hidden lg:flex` 二面構造はそのまま活用できる。

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, shadcn/ui (DropdownMenu), React 19

---

## Breakpoint Strategy

| 幅 | ヘッダー | グリッド | 旅行詳細 |
|---|---|---|---|
| < 768px (md) | ロゴ + ハンバーガー | 1列 | モバイルタブUI |
| 768–1023px | ロゴ + ナビ + ユーザー | 2列 | モバイルタブUI |
| 1024px+ (lg) | ロゴ + ナビ + ユーザー | 3列 | 2ペインサイドバー |

---

### Task 1: レイアウトから min-w-[1024px] を削除

**Files:**
- Modify: `apps/web/app/(authenticated)/layout.tsx`
- Modify: `apps/web/app/users/layout.tsx`

**Step 1: authenticated layout を修正**

`overflow-x-auto` と `min-w-[1024px]` のラッパーdivを削除し、Header + main を直接 div.min-h-screen の子にする。

```tsx
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopMobileProvider>
      <TooltipProvider>
        <ShortcutHelpProvider>
          <div className="min-h-screen">
            <Header />
            <main className="container py-4 sm:py-8">{children}</main>
          </div>
        </ShortcutHelpProvider>
      </TooltipProvider>
    </DesktopMobileProvider>
  );
}
```

**Step 2: users layout を同様に修正**

```tsx
  return (
    <DesktopMobileProvider>
      <TooltipProvider>
        <ShortcutHelpProvider>
          <div className="min-h-screen">
            <Header />
            <main className="container py-4 sm:py-8">{children}</main>
          </div>
        </ShortcutHelpProvider>
      </TooltipProvider>
    </DesktopMobileProvider>
  );
```

**Step 3: 型チェック**

```bash
bun run --filter @sugara/web check-types
```

Expected: Exited with code 0

**Step 4: Commit**

```bash
git add apps/web/app/(authenticated)/layout.tsx apps/web/app/users/layout.tsx
git commit -m "refactor(web): remove min-w-[1024px] constraint from desktop layouts"
```

---

### Task 2: Header にハンバーガーメニューを追加（md 未満）

**Files:**
- Modify: `apps/web/components/header.tsx`

**Context:**
- 現在のヘッダー: `<Logo> + [ナビリンク3本] + <ThemeToggle> + <UserAvatar dropdown>`
- 768px 未満でナビリンクが収まらなくなるため、md 未満では非表示にしてハンバーガーに入れる
- ハンバーガー: shadcn の `DropdownMenu` を流用（Sheet は不要）
- ナビリンクの表示: `hidden md:inline-flex`
- ハンバーガーボタン: `md:hidden`
- ハンバーガーの中身: ナビリンク一覧 + 区切り + ThemeToggle（省略可）

**Step 1: header.tsx を修正**

import に `Menu` を追加:
```tsx
import {
  Download,
  Keyboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Smartphone,
  User,
} from "lucide-react";
```

ナビリンクに `hidden md:inline-flex` を追加:
```tsx
<Link
  key={link.href}
  href={link.href}
  className={cn(
    "hidden md:inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors",
    pathname === link.href
      ? "bg-muted font-medium text-foreground"
      : "text-muted-foreground hover:text-foreground",
  )}
>
```

右側の flex エリアにハンバーガーを追加（`ThemeToggle` の前）:
```tsx
<div className="flex items-center gap-1">
  {/* Hamburger: visible only below md breakpoint */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="md:hidden">
        <Menu className="h-5 w-5" />
        <span className="sr-only">メニュー</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {NAV_LINKS.filter(
        (link) => !isGuest || (link.href !== "/bookmarks" && link.href !== "/friends"),
      ).map((link) => (
        <DropdownMenuItem key={link.href} asChild>
          <Link
            href={link.href}
            className={cn(pathname === link.href && "font-medium")}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
            {link.href === "/friends" && friendRequestCount > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium tabular-nums text-destructive-foreground">
                {friendRequestCount}
              </span>
            )}
          </Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>

  <ThemeToggle />
  {/* ... UserAvatar dropdown */}
```

**Step 2: lint チェック**

```bash
bun run --filter @sugara/web check
```

Expected: warnings のみ（noDocumentCookie）

**Step 3: Commit**

```bash
git add apps/web/components/header.tsx
git commit -m "feat(web): add hamburger menu for nav links below md breakpoint"
```

---

### Task 3: ホームページのグリッドを viewport ベースに戻す

**Files:**
- Modify: `apps/web/app/(authenticated)/home/page.tsx`

**Context:**
以前 `sm:grid-cols-2` → `grid-cols-2` に変更したが（`min-w-[1024px]` 前提だったため）、
`min-w` 廃止後は viewport ベースの `sm:grid-cols-2` が正しく動く。

**Step 1: スケルトングリッドを修正**

```tsx
<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

**Step 2: 実際のカードグリッドを修正**

```tsx
<div className="mt-4 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

**Step 3: Commit**

```bash
git add apps/web/app/(authenticated)/home/page.tsx
git commit -m "fix(web): restore sm:grid-cols-2 for home page after removing min-w constraint"
```

---

### Task 4: ブックマーク一覧ページのスケルトン・グリッドを修正

**Files:**
- Modify: `apps/web/app/(authenticated)/bookmarks/page.tsx`

**Context:**
- スケルトンのカード: `rounded-xl border bg-card shadow` → `rounded-lg border bg-card shadow-sm`（shadcn デフォルト）
- 実際のグリッド: 既に `sm:grid-cols-2 lg:grid-cols-3` のため変更不要

**Step 1: スケルトンカードの shape を修正**

```tsx
<div key={key} className="rounded-lg border bg-card shadow-sm">
```

**Step 2: Commit**

```bash
git add apps/web/app/(authenticated)/bookmarks/page.tsx
git commit -m "fix(web): fix bookmark page skeleton card shape to match actual card"
```

---

### Task 5: Trip 詳細ページの mobile layout ブレークポイント確認

**Files:**
- Read only: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Context:**
- `lg:hidden` (モバイルタブUI) と `hidden lg:flex` (デスクトップ2ペイン) を使用
- `min-w-[1024px]` 廃止後、1024px 未満では自動的にモバイルタブUIが表示される
- 768–1023px では「モバイルタブUI + スワイプ」になるが、これはデスクトップUIの範囲内で許容
- `lg:hidden` の mobile div には `inert` 属性がついている（`isLg` フック連動）

**Step 1: 確認事項**

`use-is-lg.ts` の閾値が 1024px であることを確認:
```bash
cat apps/web/lib/hooks/use-is-lg.ts
```

Expected: `matchMedia("(min-width: 1024px)")` 相当の実装

変更は不要。`lg:` ブレークポイントが viewport ベースで正しく動く。

---

### Task 6: globals.css の body overflow-x ルールを確認・調整

**Files:**
- Read only: `apps/web/app/globals.css`

**Context:**
現在 `@media (max-width: 1023px) { body { overflow-x: hidden } }` が設定されている。
これはモバイルでの横スクロール防止のためで、`min-w-[1024px]` 廃止後も引き続き有効。
デスクトップ（1024px+）では dnd-kit の DragOverlay が body 外にはみ出すため残す。

変更は不要（現状維持でOK）。

---

### Task 7: 全体動作確認と最終 commit

**Step 1: 型チェック**

```bash
bun run check-types
```

Expected: Exited with code 0

**Step 2: lint**

```bash
bun run check
```

Expected: warnings のみ

**Step 3: ブラウザ確認チェックリスト**

- [ ] 1280px: ホーム 3列グリッド、ヘッダー全ナビ表示
- [ ] 900px: ホーム 2列グリッド、ヘッダー全ナビ表示
- [ ] 700px: ホーム 2列グリッド、ヘッダー ハンバーガー表示
- [ ] 400px: ホーム 1列グリッド、ヘッダー ハンバーガー表示
- [ ] 旅行詳細 1024px+: 2ペイン表示
- [ ] 旅行詳細 1023px-: モバイルタブ表示
- [ ] SP版切り替え（ユーザーメニュー内）が引き続き機能する

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore(web): desktop responsive layout complete"
```

---

## 変更しない箇所

- `apps/web/app/(sp)/` 以下: SP版は別系統、変更なし
- `apps/web/components/trip-toolbar.tsx`: `useMobile()` による分岐は正しく機能する（`DesktopMobileProvider` で `false` が供給されるため desktop 用 Select が表示される）
- `apps/web/app/(authenticated)/friends/page.tsx`: `max-w-2xl` 中央寄せでそのままレスポンシブ
- `apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx`: lg: 以上でのみ表示されるため変更不要
