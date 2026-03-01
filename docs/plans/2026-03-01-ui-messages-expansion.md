# UI Messages Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add empty state messages, UI status messages, and `VISIBILITY_LABELS` to `packages/shared/src/messages.ts`, then replace all hardcoded strings across ~22 component files.

**Architecture:** `MSG` in `packages/shared/src/messages.ts` gets an `// Empty states` section and `// UI status` section. A new `VISIBILITY_LABELS` export is added to the same file following the `ROLE_LABELS` pattern. Consumer files already import `MSG` via `@/lib/messages`; `VISIBILITY_LABELS` is imported directly from `@sugara/shared`.

**Tech Stack:** TypeScript, Turborepo monorepo, Next.js (App Router)

---

## Current state

All target strings are hardcoded in JSX. Most files already `import { MSG } from "@/lib/messages"`. Four files need a new `MSG` import added. Four files need `VISIBILITY_LABELS` from `@sugara/shared`.

---

### Task 1: Add entries to packages/shared/src/messages.ts

**Files:**
- Modify: `packages/shared/src/messages.ts`

**Step 1: Add Empty states and UI status sections to MSG**

In `packages/shared/src/messages.ts`, find the closing `} as const;` of `MSG` and insert the new sections just before it.

The last few lines of MSG currently end with:
```typescript
  SHARED_TRIP_NOT_FOUND: "旅行が見つかりません",
} as const;
```

Change to:
```typescript
  SHARED_TRIP_NOT_FOUND: "旅行が見つかりません",

  // Empty states
  EMPTY_TRIP: "まだ旅行がありません",
  EMPTY_TRIP_SHARED: "共有された旅行はありません",
  EMPTY_TRIP_FILTER: "条件に一致する旅行がありません",
  EMPTY_SCHEDULE: "まだ予定がありません",
  EMPTY_CANDIDATE: "候補がありません",
  EMPTY_BOOKMARK_LIST: "リストがありません",
  EMPTY_BOOKMARK_LIST_FILTER: "条件に一致するリストがありません",
  EMPTY_BOOKMARK: "ブックマークがありません",
  EMPTY_FRIEND: "フレンドがいません",
  EMPTY_MEMBER: "まだメンバーがいません",
  EMPTY_GROUP: "グループがありません",
  EMPTY_NOTIFICATION: "通知はありません",
  EMPTY_EXPENSE: "費用はまだ記録されていません",
  EMPTY_SOUVENIR: "お土産リストはまだありません",
  EMPTY_NEWS: "お知らせはまだありません",
  EMPTY_EXPORT_SHEET: "このシートにデータがありません",

  // UI status
  MEMBER_ALL_ADDED: "全員追加済みです",
  NO_CHANGES: "変更がありません",
} as const;
```

**Step 2: Add VISIBILITY_LABELS export**

After the closing `};` of `SCHEDULE_COLOR_LABELS` (last export in the file), append:

```typescript
export const VISIBILITY_LABELS = {
  private: "非公開",
  friends_only: "フレンド限定",
  public: "全体公開",
} as const;
```

**Step 3: Run type-check**

```bash
bun run check-types
```

Expected: no errors (new entries are valid, no consumers changed yet).

**Step 4: Commit**

```bash
git add packages/shared/src/messages.ts
git commit -m "feat: MSG に空の状態・UI ステータスエントリを追加、VISIBILITY_LABELS を追加"
```

---

### Task 2: Update home pages

**Files:**
- Modify: `apps/web/app/(authenticated)/home/page.tsx`
- Modify: `apps/web/app/(sp)/sp/home/page.tsx`

Both files already have `import { MSG } from "@/lib/messages"`.

**Step 1: Update authenticated home page**

`apps/web/app/(authenticated)/home/page.tsx` line ~361:

```tsx
// Before (roughly):
? "共有された旅行はありません"
: "まだ旅行がありません。旅行を作成してプランを立てましょう"}
// ...
<p ... >条件に一致する旅行がありません</p>

// After:
? MSG.EMPTY_TRIP_SHARED
: MSG.EMPTY_TRIP}
// ...
<p ... >{MSG.EMPTY_TRIP_FILTER}</p>
```

**Step 2: Update SP home page**

`apps/web/app/(sp)/sp/home/page.tsx` line ~260:

Same pattern as above — replace the three strings with `MSG.EMPTY_TRIP_SHARED`, `MSG.EMPTY_TRIP`, `MSG.EMPTY_TRIP_FILTER`.

**Step 3: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/app/(authenticated)/home/page.tsx apps/web/app/(sp)/sp/home/page.tsx
git commit -m "refactor: home ページの空の状態メッセージを MSG 定数に置き換え"
```

---

### Task 3: Update bookmark list pages

**Files:**
- Modify: `apps/web/app/(authenticated)/bookmarks/page.tsx`
- Modify: `apps/web/app/(sp)/sp/bookmarks/page.tsx`
- Modify: `apps/web/app/(authenticated)/bookmarks/[listId]/page.tsx`
- Modify: `apps/web/app/(sp)/sp/bookmarks/[listId]/page.tsx`

All files already have `import { MSG } from "@/lib/messages"`.

**Step 1: Update authenticated bookmarks/page.tsx**

Line ~289:
```tsx
// Before:
"まだリストがありません。新規作成からブックマークリストを作成してみましょう"
// After:
{MSG.EMPTY_BOOKMARK_LIST}
```

Line ~293:
```tsx
// Before:
"条件に一致するリストがありません"
// After:
{MSG.EMPTY_BOOKMARK_LIST_FILTER}
```

**Step 2: Update SP bookmarks/page.tsx**

Line ~257 and ~261: Same replacements with `MSG.EMPTY_BOOKMARK_LIST` and `MSG.EMPTY_BOOKMARK_LIST_FILTER`.

**Step 3: Update authenticated bookmarks/[listId]/page.tsx**

Line ~228:
```tsx
// Before:
"まだブックマークがありません。追加からブックマークを登録してみましょう"
// After:
{MSG.EMPTY_BOOKMARK}
```

**Step 4: Update SP bookmarks/[listId]/page.tsx**

Line ~226: Same replacement with `MSG.EMPTY_BOOKMARK`.

**Step 5: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/web/app/(authenticated)/bookmarks/page.tsx apps/web/app/(sp)/sp/bookmarks/page.tsx apps/web/app/(authenticated)/bookmarks/[listId]/page.tsx apps/web/app/(sp)/sp/bookmarks/[listId]/page.tsx
git commit -m "refactor: ブックマークページの空の状態メッセージを MSG 定数に置き換え"
```

---

### Task 4: Update schedule / candidate components

**Files:**
- Modify: `apps/web/components/day-timeline.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/print/page.tsx`
- Modify: `apps/web/app/shared/[token]/_components/shared-trip-client.tsx`
- Modify: `apps/web/components/candidate-panel.tsx`

All files already have `import { MSG } from "@/lib/messages"`.

**Step 1: Update day-timeline.tsx**

Line ~366:
```tsx
// Before:
<p className="text-sm text-muted-foreground">まだ予定がありません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_SCHEDULE}</p>
```

**Step 2: Update print/page.tsx**

Line ~136:
```tsx
// Before:
<p ...>まだ予定がありません</p>
// After:
<p ...>{MSG.EMPTY_SCHEDULE}</p>
```

**Step 3: Update shared-trip-client.tsx**

Line ~294:
```tsx
// Before:
<p ...>まだ予定がありません</p>
// After:
<p ...>{MSG.EMPTY_SCHEDULE}</p>
```

**Step 4: Update candidate-panel.tsx**

Lines ~688 and ~751 (two occurrences of `"候補がありません"`):
```tsx
// Before:
<p className="text-sm text-muted-foreground">候補がありません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_CANDIDATE}</p>
```

**Step 5: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/web/components/day-timeline.tsx apps/web/app/(authenticated)/trips/[id]/print/page.tsx apps/web/app/shared/[token]/_components/shared-trip-client.tsx apps/web/components/candidate-panel.tsx
git commit -m "refactor: スケジュール・候補の空の状態メッセージを MSG 定数に置き換え"
```

---

### Task 5: Update bookmark components and users page

**Files:**
- Modify: `apps/web/components/bookmark-panel.tsx`
- Modify: `apps/web/components/bookmark-list-picker-dialog.tsx`
- Modify: `apps/web/app/users/[userId]/page.tsx`

`bookmark-panel.tsx` already has `import { MSG }`. The other two do not.

**Step 1: Update bookmark-panel.tsx**

Line ~130:
```tsx
// Before:
<p className="text-sm text-muted-foreground">ブックマークリストがありません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_BOOKMARK_LIST}</p>
```

Line ~207:
```tsx
// Before:
<p ...>ブックマークがありません</p>
// After:
<p ...>{MSG.EMPTY_BOOKMARK}</p>
```

**Step 2: Update bookmark-list-picker-dialog.tsx**

Add import at the top:
```tsx
import { MSG } from "@/lib/messages";
```

Line ~58:
```tsx
// Before:
<p className="text-sm text-muted-foreground">リストがありません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_BOOKMARK_LIST}</p>
```

**Step 3: Update users/[userId]/page.tsx**

Add import at the top:
```tsx
import { MSG } from "@/lib/messages";
```

Line ~98:
```tsx
// Before:
<p className="text-sm text-muted-foreground">ブックマークがありません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_BOOKMARK}</p>
```

Line ~161:
```tsx
// Before:
<p className="text-muted-foreground">リストがありません</p>
// After:
<p className="text-muted-foreground">{MSG.EMPTY_BOOKMARK_LIST}</p>
```

**Step 4: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/components/bookmark-panel.tsx apps/web/components/bookmark-list-picker-dialog.tsx apps/web/app/users/[userId]/page.tsx
git commit -m "refactor: ブックマーク関連コンポーネントの空の状態メッセージを MSG 定数に置き換え"
```

---

### Task 6: Update friends / groups / members components

**Files:**
- Modify: `apps/web/app/(authenticated)/friends/_components/friends-tab.tsx`
- Modify: `apps/web/app/(authenticated)/friends/_components/group-detail-dialog.tsx`
- Modify: `apps/web/components/member-dialog.tsx`
- Modify: `apps/web/app/(authenticated)/friends/_components/groups-tab.tsx`

All files already have `import { MSG } from "@/lib/messages"`.

**Step 1: Update friends-tab.tsx**

Line ~84:
```tsx
// Before:
<p className="text-sm text-muted-foreground">フレンドがいません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_FRIEND}</p>
```

**Step 2: Update group-detail-dialog.tsx**

Line ~225 (EMPTY_MEMBER):
```tsx
// Before:
まだメンバーがいません
// After:
{MSG.EMPTY_MEMBER}
```

Line ~271-272 (EMPTY_FRIEND と MEMBER_ALL_ADDED):
```tsx
// Before:
フレンドがいません
全員追加済みです
// After:
{MSG.EMPTY_FRIEND}
{MSG.MEMBER_ALL_ADDED}
```

**Step 3: Update member-dialog.tsx**

Line ~347-348 (EMPTY_FRIEND, MEMBER_ALL_ADDED):
```tsx
// Before:
フレンドがいません
全員追加済みです
// After:
{MSG.EMPTY_FRIEND}
{MSG.MEMBER_ALL_ADDED}
```

Line ~405-406 (EMPTY_GROUP):
```tsx
// Before:
グループがありません
// After:
{MSG.EMPTY_GROUP}
```

Line ~442-443 (MEMBER_ALL_ADDED):
```tsx
// Before:
全員追加済みです
// After:
{MSG.MEMBER_ALL_ADDED}
```

**Step 4: Update groups-tab.tsx**

Line ~152:
```tsx
// Before:
<p className="text-sm text-muted-foreground">グループがありません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_GROUP}</p>
```

**Step 5: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 6: Commit**

```bash
git add apps/web/app/(authenticated)/friends/_components/friends-tab.tsx apps/web/app/(authenticated)/friends/_components/group-detail-dialog.tsx apps/web/components/member-dialog.tsx apps/web/app/(authenticated)/friends/_components/groups-tab.tsx
git commit -m "refactor: フレンド・グループ・メンバーコンポーネントの空の状態メッセージを MSG 定数に置き換え"
```

---

### Task 7: Update misc components

**Files:**
- Modify: `apps/web/components/notification-bell.tsx`
- Modify: `apps/web/components/expense-panel.tsx`
- Modify: `apps/web/components/souvenir-panel.tsx`
- Modify: `apps/web/app/news/page.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/export/page.tsx`
- Modify: `apps/web/app/(authenticated)/settings/page.tsx`

`notification-bell.tsx`, `expense-panel.tsx`, `export/page.tsx`, `settings/page.tsx` already have `import { MSG }`. `souvenir-panel.tsx` and `news/page.tsx` do not.

**Step 1: Update notification-bell.tsx**

Line ~97:
```tsx
// Before:
通知はありません
// After:
{MSG.EMPTY_NOTIFICATION}
```

**Step 2: Update expense-panel.tsx**

Line ~214:
```tsx
// Before:
<p ...>費用はまだ記録されていません</p>
// After:
<p ...>{MSG.EMPTY_EXPENSE}</p>
```

**Step 3: Update souvenir-panel.tsx**

Add import at the top:
```tsx
import { MSG } from "@/lib/messages";
```

Line ~258:
```tsx
// Before:
<p className="text-sm text-muted-foreground">お土産リストはまだありません</p>
// After:
<p className="text-sm text-muted-foreground">{MSG.EMPTY_SOUVENIR}</p>
```

**Step 4: Update news/page.tsx**

Add import at the top:
```tsx
import { MSG } from "@/lib/messages";
```

Line ~24:
```tsx
// Before:
<p ...>お知らせはまだありません。</p>
// After:
<p ...>{MSG.EMPTY_NEWS}</p>
```

**Step 5: Update export/page.tsx**

Line ~690:
```tsx
// Before:
"このシートにデータがありません"
// After:
MSG.EMPTY_EXPORT_SHEET
```

**Step 6: Update settings/page.tsx**

Lines ~425 and ~504 (two occurrences of `"変更がありません"`):
```tsx
// Before:
<TooltipContent>変更がありません</TooltipContent>
// After:
<TooltipContent>{MSG.NO_CHANGES}</TooltipContent>
```

**Step 7: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 8: Commit**

```bash
git add apps/web/components/notification-bell.tsx apps/web/components/expense-panel.tsx apps/web/components/souvenir-panel.tsx apps/web/app/news/page.tsx "apps/web/app/(authenticated)/trips/[id]/export/page.tsx" "apps/web/app/(authenticated)/settings/page.tsx"
git commit -m "refactor: 各種コンポーネントの空の状態・UI ステータスメッセージを MSG 定数に置き換え"
```

---

### Task 8: Update VISIBILITY_LABELS consumers

**Files:**
- Modify: `apps/web/app/(authenticated)/bookmarks/[listId]/_components/bookmark-dialogs.tsx`
- Modify: `apps/web/components/create-bookmark-list-dialog.tsx`
- Modify: `apps/web/app/(authenticated)/bookmarks/[listId]/_components/bookmark-list-header.tsx`
- Modify: `apps/web/components/bookmark-list-card.tsx`
- Modify: `apps/web/app/(authenticated)/bookmarks/page.tsx`
- Modify: `apps/web/app/(sp)/sp/bookmarks/page.tsx`

All files need `import { VISIBILITY_LABELS } from "@sugara/shared"` added.

**Step 1: Update bookmark-dialogs.tsx**

Add import:
```tsx
import { VISIBILITY_LABELS } from "@sugara/shared";
```

Lines ~80-82:
```tsx
// Before:
<SelectItem value="private">非公開</SelectItem>
<SelectItem value="friends_only">フレンド限定</SelectItem>
<SelectItem value="public">全体公開</SelectItem>

// After:
<SelectItem value="private">{VISIBILITY_LABELS.private}</SelectItem>
<SelectItem value="friends_only">{VISIBILITY_LABELS.friends_only}</SelectItem>
<SelectItem value="public">{VISIBILITY_LABELS.public}</SelectItem>
```

**Step 2: Update create-bookmark-list-dialog.tsx**

Add import:
```tsx
import { VISIBILITY_LABELS } from "@sugara/shared";
```

Lines ~113-115: Same replacement as above.

**Step 3: Update bookmark-list-header.tsx**

Add import:
```tsx
import { VISIBILITY_LABELS } from "@sugara/shared";
```

Lines ~87-91 (badge display, currently shows "公開" not "全体公開"):
```tsx
// Before (something like):
visibility === "public" ? "公開" : visibility === "friends_only" ? "フレンド限定" : "非公開"
// After:
VISIBILITY_LABELS[visibility]
```

**Step 4: Update bookmark-list-card.tsx**

Add import:
```tsx
import { VISIBILITY_LABELS } from "@sugara/shared";
```

Lines ~48-52 (same pattern as bookmark-list-header.tsx):
```tsx
// Before:
visibility === "public" ? "公開" : visibility === "friends_only" ? "フレンド限定" : "非公開"
// After:
VISIBILITY_LABELS[visibility]
```

**Step 5: Update authenticated bookmarks/page.tsx filter labels**

Add import:
```tsx
import { VISIBILITY_LABELS } from "@sugara/shared";
```

Lines ~57-58 (filter options array):
```tsx
// Before:
{ value: "friends_only", label: "フレンド限定" },
{ value: "private", label: "非公開" },
// After:
{ value: "friends_only", label: VISIBILITY_LABELS.friends_only },
{ value: "private", label: VISIBILITY_LABELS.private },
```

**Step 6: Update SP bookmarks/page.tsx filter labels**

Add import:
```tsx
import { VISIBILITY_LABELS } from "@sugara/shared";
```

Lines ~53-54:
```tsx
// Before:
{ value: "friends_only", label: "フレンド限定", icon: ... },
{ value: "private", label: "非公開", icon: ... },
// After:
{ value: "friends_only", label: VISIBILITY_LABELS.friends_only, icon: ... },
{ value: "private", label: VISIBILITY_LABELS.private, icon: ... },
```

**Step 7: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 8: Run tests**

```bash
bun run test
```

Expected: all tests pass (same counts as before).

**Step 9: Commit**

```bash
git add "apps/web/app/(authenticated)/bookmarks/[listId]/_components/bookmark-dialogs.tsx" apps/web/components/create-bookmark-list-dialog.tsx "apps/web/app/(authenticated)/bookmarks/[listId]/_components/bookmark-list-header.tsx" apps/web/components/bookmark-list-card.tsx "apps/web/app/(authenticated)/bookmarks/page.tsx" apps/web/app/(sp)/sp/bookmarks/page.tsx
git commit -m "refactor: VISIBILITY_LABELS を使用して公開範囲ラベルを統一"
```

---

### Task 9: Final verification

**Step 1: Run full test suite**

```bash
bun run test
```

Expected: all tests pass.

**Step 2: Run type-check**

```bash
bun run check-types
```

Expected: no errors.

**Step 3: Run lint/format**

```bash
bun run check
```

Expected: no errors (existing cookie warning は無視).

**Step 4: Verify no hardcoded strings remain**

```bash
# 空の状態メッセージの残存確認
grep -r "まだ.*がありません\|まだ.*がいません\|がありません\|がいません\|はありません" apps/web/app apps/web/components --include="*.tsx" | grep -v "MSG\.\|node_modules"
```

Expected: 0 件（または無関係なものだけ）。
