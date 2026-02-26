# ActionSheet UI 改善 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ActionSheet のボタンを左寄せにし、キャンセルボタンにアイコンを追加し、trip-toolbar のアクションにアイコンを補完する

**Architecture:** 変更は2ファイルのみ。`action-sheet.tsx` は className と import の変更、`trip-toolbar.tsx` はアクション配列へのアイコン追加。型変更なし。

**Tech Stack:** React, Tailwind CSS v4, lucide-react

---

### Task 1: action-sheet.tsx - 左寄せ + キャンセルアイコン

**Files:**
- Modify: `apps/web/components/action-sheet.tsx`

**Step 1: X アイコンを import に追加**

現在の import 行:
```tsx
import { type ReactNode, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
```

変更後:
```tsx
import { type ReactNode, useLayoutEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
```

**Step 2: アクションボタンに `justify-start` を追加**

変更前 (40行目):
```tsx
className="h-12 w-full text-base"
```

変更後:
```tsx
className="h-12 w-full justify-start text-base"
```

**Step 3: キャンセルボタンに `justify-start` と `X` アイコンを追加**

変更前 (50〜56行目):
```tsx
<Button
  variant="outline"
  className="mt-1 h-12 w-full text-base"
  onClick={() => onOpenChange(false)}
>
  キャンセル
</Button>
```

変更後:
```tsx
<Button
  variant="outline"
  className="mt-1 h-12 w-full justify-start text-base"
  onClick={() => onOpenChange(false)}
>
  <X className="mr-2 h-4 w-4" />
  キャンセル
</Button>
```

**Step 4: lint チェック**

```bash
bun run --filter @sugara/web check
```

Expected: エラーなし（warning は既存のものだけ）

**Step 5: コミット**

```bash
git add apps/web/components/action-sheet.tsx
git commit -m "feat(web): ActionSheetボタンを左寄せにしキャンセルにアイコンを追加"
```

---

### Task 2: trip-toolbar.tsx - ステータスフィルタ・ソートにアイコン追加

**Files:**
- Modify: `apps/web/components/trip-toolbar.tsx`

**Step 1: `ListFilter` と `ArrowUpDown` を import に追加**

現在の import 行 (5行目):
```tsx
import { ChevronDown, Copy, MoreHorizontal, SquareMousePointer, Trash2, X } from "lucide-react";
```

変更後:
```tsx
import { ArrowUpDown, ChevronDown, Copy, ListFilter, MoreHorizontal, SquareMousePointer, Trash2, X } from "lucide-react";
```

**Step 2: `statusFilters` にアイコンを追加**

変更前 (65〜71行目):
```tsx
const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as TripStatus,
    label,
  })),
];
```

変更後:
```tsx
const statusFilters: { value: StatusFilter; label: string; icon: ReactNode }[] = [
  { value: "all", label: "すべて", icon: <ListFilter className="h-4 w-4" /> },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as TripStatus,
    label,
    icon: <ListFilter className="h-4 w-4" />,
  })),
];
```

**Step 3: `ReactNode` を react から import する**

現在の import 行:
```tsx
import { useState } from "react";
```

変更後:
```tsx
import { type ReactNode, useState } from "react";
```

**Step 4: `sortOptions` にアイコンを追加**

変更前 (73〜76行目):
```tsx
const sortOptions: { value: SortKey; label: string }[] = [
  { value: "updatedAt", label: "更新日" },
  { value: "startDate", label: "出発日" },
];
```

変更後:
```tsx
const sortOptions: { value: SortKey; label: string; icon: ReactNode }[] = [
  { value: "updatedAt", label: "更新日", icon: <ArrowUpDown className="h-4 w-4" /> },
  { value: "startDate", label: "出発日", icon: <ArrowUpDown className="h-4 w-4" /> },
];
```

**Step 5: statusFilters の ActionSheet に icon を渡す**

変更前 (253〜256行目):
```tsx
actions={statusFilters.map((f) => ({
  label: f.label,
  onClick: () => onStatusFilterChange(f.value),
}))}
```

変更後:
```tsx
actions={statusFilters.map((f) => ({
  label: f.label,
  icon: f.icon,
  onClick: () => onStatusFilterChange(f.value),
}))}
```

**Step 6: sortOptions の ActionSheet に icon を渡す**

変更前 (294〜297行目):
```tsx
actions={sortOptions.map((s) => ({
  label: s.label,
  onClick: () => onSortKeyChange(s.value),
}))}
```

変更後:
```tsx
actions={sortOptions.map((s) => ({
  label: s.label,
  icon: s.icon,
  onClick: () => onSortKeyChange(s.value),
}))}
```

**Step 7: lint + 型チェック**

```bash
bun run --filter @sugara/web check
bun run check-types
```

Expected: エラーなし

**Step 8: コミット**

```bash
git add apps/web/components/trip-toolbar.tsx
git commit -m "feat(web): trip-toolbarのActionSheetにアイコンを追加"
```
