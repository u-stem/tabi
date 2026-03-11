# ルーレットツール Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** プロフィールから飛べるルーレットツールを追加する。都道府県/カスタム/ブックマークの3モードで、ランダムに1つ選ぶ。

**Architecture:** フロントエンドのみの機能。DB変更なし。都道府県データは定数ファイル、カスタムモードはローカルステート、ブックマークモードは既存APIを利用。テキストシャッフルアニメーションは CSS transition + `setInterval` で実装。デスクトップ版 `/tools/roulette` と SP版 `/sp/tools/roulette` を作成し、`/my` ページのツールセクションにリンクを追加。

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, shadcn/ui (Tabs), lucide-react, React Query

---

### Task 1: 都道府県データの定数ファイル

**Files:**
- Create: `apps/web/lib/prefectures.ts`

**Step 1: 定数ファイルを作成**

```typescript
export type Region = {
  name: string;
  prefectures: string[];
};

export const REGIONS: Region[] = [
  {
    name: "北海道・東北",
    prefectures: ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県"],
  },
  {
    name: "関東",
    prefectures: ["茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県"],
  },
  {
    name: "中部",
    prefectures: [
      "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県",
    ],
  },
  {
    name: "近畿",
    prefectures: ["三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県"],
  },
  {
    name: "中国・四国",
    prefectures: [
      "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県",
    ],
  },
  {
    name: "九州・沖縄",
    prefectures: [
      "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
    ],
  },
];

export const ALL_PREFECTURES = REGIONS.flatMap((r) => r.prefectures);
```

**Step 2: コミット**

```bash
git add apps/web/lib/prefectures.ts
git commit -m "feat: 都道府県データの定数ファイルを追加"
```

---

### Task 2: ルーレットのコアロジック (useRoulette フック)

**Files:**
- Create: `apps/web/lib/hooks/use-roulette.ts`
- Create: `apps/web/lib/__tests__/roulette.test.ts`

**Step 1: テストを書く**

```typescript
import { describe, expect, it } from "vitest";
import { pickRandom } from "../roulette";

describe("pickRandom", () => {
  it("returns an item from the candidates", () => {
    const candidates = ["A", "B", "C"];
    const result = pickRandom(candidates);
    expect(candidates).toContain(result);
  });

  it("throws when candidates is empty", () => {
    expect(() => pickRandom([])).toThrow();
  });
});
```

**Step 2: テスト実行で失敗を確認**

```bash
bun run --filter @sugara/web test
```

Expected: FAIL (module not found)

**Step 3: ロジックファイルを作成**

`apps/web/lib/roulette.ts`:

```typescript
export function pickRandom<T>(candidates: T[]): T {
  if (candidates.length === 0) throw new Error("No candidates");
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

**Step 4: useRoulette フックを作成**

`apps/web/lib/hooks/use-roulette.ts`:

```typescript
import { useCallback, useRef, useState } from "react";
import { pickRandom } from "../roulette";

type RouletteState = "idle" | "spinning" | "result";

export function useRoulette(candidates: string[]) {
  const [state, setState] = useState<RouletteState>("idle");
  const [display, setDisplay] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const spin = useCallback(() => {
    if (candidates.length === 0) return;

    setState("spinning");
    const result = pickRandom(candidates);
    let tick = 0;
    const totalTicks = 20;

    intervalRef.current = setInterval(() => {
      tick++;
      setDisplay(pickRandom(candidates));
      if (tick >= totalTicks) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplay(result);
        setState("result");
      }
    }, 80 + tick * 8);
  }, [candidates]);

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState("idle");
    setDisplay("");
  }, []);

  return { state, display, spin, reset };
}
```

**Step 5: テスト実行で成功を確認**

```bash
bun run --filter @sugara/web test
```

**Step 6: コミット**

```bash
git add apps/web/lib/roulette.ts apps/web/lib/__tests__/roulette.test.ts apps/web/lib/hooks/use-roulette.ts
git commit -m "feat: ルーレットのコアロジックとフックを追加"
```

---

### Task 3: ルーレットページ (都道府県モード + カスタムモード)

**Files:**
- Create: `apps/web/app/(authenticated)/tools/roulette/page.tsx`

**Step 1: ページコンポーネントを作成**

```typescript
"use client";

import type { BookmarkListDetailResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Dices, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { useBookmarkLists } from "@/lib/hooks/use-bookmark-lists";
import { useRoulette } from "@/lib/hooks/use-roulette";
import { ALL_PREFECTURES, REGIONS } from "@/lib/prefectures";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type Mode = "prefecture" | "custom" | "bookmark";

function RouletteDisplay({
  state,
  display,
  onSpin,
  onReset,
  disabled,
}: {
  state: "idle" | "spinning" | "result";
  display: string;
  onSpin: () => void;
  onReset: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div
        className={cn(
          "flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed text-center",
          state === "result" && "border-solid border-primary bg-primary/5",
          state === "spinning" && "border-solid border-muted-foreground",
        )}
      >
        <span
          className={cn(
            "text-2xl font-bold transition-opacity",
            state === "idle" && "text-muted-foreground",
            state === "spinning" && "text-foreground",
            state === "result" && "text-primary text-3xl",
          )}
        >
          {state === "idle" ? "?" : display}
        </span>
      </div>
      <div className="flex gap-3">
        {state === "result" ? (
          <>
            <Button variant="outline" onClick={onReset}>
              <RotateCcw className="h-4 w-4" /> リセット
            </Button>
            <Button onClick={onSpin}>
              <Dices className="h-4 w-4" /> もう一回
            </Button>
          </>
        ) : (
          <Button onClick={onSpin} disabled={disabled || state === "spinning"} size="lg">
            <Dices className="h-4 w-4" /> {state === "spinning" ? "選択中..." : "回す"}
          </Button>
        )}
      </div>
    </div>
  );
}

function PrefectureMode() {
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());

  const candidates = useMemo(() => {
    if (selectedRegions.size === 0) return ALL_PREFECTURES;
    return REGIONS.filter((r) => selectedRegions.has(r.name)).flatMap((r) => r.prefectures);
  }, [selectedRegions]);

  const { state, display, spin, reset } = useRoulette(candidates);

  const toggleRegion = useCallback((name: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">地域で絞り込み（未選択で全国）</p>
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <button
              key={r.name}
              type="button"
              onClick={() => toggleRegion(r.name)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                selectedRegions.has(r.name)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {r.name}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{candidates.length}件</p>
      </div>
      <RouletteDisplay
        state={state}
        display={display}
        onSpin={spin}
        onReset={reset}
        disabled={candidates.length === 0}
      />
    </div>
  );
}

function CustomMode() {
  const [items, setItems] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const addItem = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setItems((prev) => [...prev, trimmed]);
    setInput("");
  }, [input]);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addItem();
      }
    },
    [addItem],
  );

  const { state, display, spin, reset } = useRoulette(items);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="選択肢を入力"
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={addItem} disabled={!input.trim()}>
            <Plus className="h-4 w-4" /> 追加
          </Button>
        </div>
        {items.length > 0 && (
          <div className="space-y-1">
            {items.map((item, i) => (
              <div
                key={`${item}-${i}`}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">{items.length}件</p>
          </div>
        )}
      </div>
      <RouletteDisplay
        state={state}
        display={display}
        onSpin={spin}
        onReset={reset}
        disabled={items.length === 0}
      />
    </div>
  );
}

function BookmarkMode() {
  const { lists, isLoading } = useBookmarkLists();
  const [selectedListId, setSelectedListId] = useState<string>("");

  const { data: listDetail } = useQuery({
    queryKey: queryKeys.bookmarks.list(selectedListId),
    queryFn: () => api<BookmarkListDetailResponse>(`/api/bookmark-lists/${selectedListId}`),
    enabled: !!selectedListId,
  });

  const candidates = useMemo(
    () => (listDetail?.bookmarks ?? []).map((b) => b.name),
    [listDetail],
  );

  const { state, display, spin, reset } = useRoulette(candidates);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Select value={selectedListId} onValueChange={setSelectedListId}>
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "読み込み中..." : "リストを選択"} />
          </SelectTrigger>
          <SelectContent>
            {lists.map((list) => (
              <SelectItem key={list.id} value={list.id}>
                {list.name} ({list.bookmarkCount}件)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {candidates.length > 0 && (
          <p className="text-xs text-muted-foreground">{candidates.length}件のアイテム</p>
        )}
      </div>
      <RouletteDisplay
        state={state}
        display={display}
        onSpin={spin}
        onReset={reset}
        disabled={candidates.length === 0}
      />
    </div>
  );
}

export default function RoulettePage() {
  const [mode, setMode] = useState<Mode>("prefecture");

  useEffect(() => {
    document.title = pageTitle("ルーレット");
  }, []);

  return (
    <div className="mt-4 mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">ルーレット</h1>
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="w-full">
          <TabsTrigger value="prefecture" className="flex-1">
            都道府県
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex-1">
            カスタム
          </TabsTrigger>
          <TabsTrigger value="bookmark" className="flex-1">
            ブックマーク
          </TabsTrigger>
        </TabsList>
        <TabsContent value="prefecture">
          <PrefectureMode />
        </TabsContent>
        <TabsContent value="custom">
          <CustomMode />
        </TabsContent>
        <TabsContent value="bookmark">
          <BookmarkMode />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**注意:** `useBookmarkLists` フックの実際のインターフェースを確認すること。上記は `{ lists, isLoading }` を返す前提だが、実際のフックに合わせて修正する。

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: コミット**

```bash
git add apps/web/app/\(authenticated\)/tools/roulette/page.tsx
git commit -m "feat: ルーレットページを追加（都道府県・カスタム・ブックマーク）"
```

---

### Task 4: SP版ルーレットページ

**Files:**
- Create: `apps/web/app/(sp)/sp/tools/roulette/page.tsx`

**Step 1: SP版を作成**

デスクトップ版と同じコンポーネントを使い回す。ルーレットの各モードコンポーネントを共有ファイルに抽出するか、ページ自体を再利用する。

最もシンプルなアプローチ: ルーレットの実体コンポーネントを `apps/web/components/roulette-content.tsx` に抽出し、デスクトップ版・SP版の両方から import する。

`apps/web/components/roulette-content.tsx`:
- Task 3 の `RoulettePage` から `<div className="mt-4...">` の中身をそのまま `RouletteContent` として export
- `pageTitle` の設定はページ側で行う

`apps/web/app/(authenticated)/tools/roulette/page.tsx`:
```typescript
"use client";

import { useEffect } from "react";
import { RouletteContent } from "@/components/roulette-content";
import { pageTitle } from "@/lib/constants";

export default function RoulettePage() {
  useEffect(() => {
    document.title = pageTitle("ルーレット");
  }, []);

  return (
    <div className="mt-4 mx-auto max-w-lg space-y-6">
      <RouletteContent />
    </div>
  );
}
```

`apps/web/app/(sp)/sp/tools/roulette/page.tsx`:
```typescript
"use client";

import { useEffect } from "react";
import { RouletteContent } from "@/components/roulette-content";
import { pageTitle } from "@/lib/constants";

export default function SpRoulettePage() {
  useEffect(() => {
    document.title = pageTitle("ルーレット");
  }, []);

  return (
    <div className="mt-4 mx-auto max-w-lg space-y-6">
      <RouletteContent />
    </div>
  );
}
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: コミット**

```bash
git add apps/web/components/roulette-content.tsx apps/web/app/\(authenticated\)/tools/roulette/page.tsx apps/web/app/\(sp\)/sp/tools/roulette/page.tsx
git commit -m "feat: ルーレットコンポーネントを共有化し SP 版を追加"
```

---

### Task 5: /my ページにルーレットリンクを追加

**Files:**
- Modify: `apps/web/app/(authenticated)/my/page.tsx`
- Modify: `apps/web/app/(sp)/sp/my/page.tsx`

**Step 1: デスクトップ版 /my にリンクを追加**

`apps/web/app/(authenticated)/my/page.tsx` の import に `Dices` を追加:

```typescript
import { Check, ChevronRight, Copy, Dices, Pencil, Vote } from "lucide-react";
```

ツールセクション (line 122-133) の `</Link>` の後にルーレットリンクを追加:

```typescript
<Link
  href="/tools/roulette"
  className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:bg-accent transition-colors"
>
  <Dices className="h-5 w-5 text-muted-foreground" />
  <span className="flex-1 font-medium">ルーレット</span>
  <ChevronRight className="h-4 w-4 text-muted-foreground" />
</Link>
```

**Step 2: SP版 /my にリンクを追加**

`apps/web/app/(sp)/sp/my/page.tsx` にも同様に追加。`href` は `/sp/tools/roulette` にする。

**Step 3: 型チェック**

```bash
bun run check-types
```

**Step 4: コミット**

```bash
git add apps/web/app/\(authenticated\)/my/page.tsx apps/web/app/\(sp\)/sp/my/page.tsx
git commit -m "feat: プロフィールページにルーレットリンクを追加"
```

---

### Task 6: FAQ を追加

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`

**Step 1: ルーレットツールの FAQ エントリを追加**

適切な `sortOrder` で FAQ を追加:

```typescript
{
  question: "ルーレット機能とは？",
  answer: "旅行先やアクティビティをランダムに決めるツールです。プロフィールページの「ツール」セクションからアクセスできます。都道府県モード（地域フィルタ付き）、カスタムモード（自分で選択肢を入力）、ブックマークモード（ブックマークリストからランダム選択）の3つのモードがあります。",
  sortOrder: 81,
},
```

**Step 2: FAQ を投入**

```bash
bun run --filter @sugara/api db:seed-faqs
```

**Step 3: コミット**

```bash
git add apps/api/src/db/seed-faqs.ts
git commit -m "docs: ルーレット機能の FAQ を追加"
```

---

### Task 7: 全体検証

**Step 1: lint + format**

```bash
bun run check
```

**Step 2: 型チェック**

```bash
bun run check-types
```

**Step 3: テスト**

```bash
bun run test
```

**Step 4: 問題があれば修正してコミット**
