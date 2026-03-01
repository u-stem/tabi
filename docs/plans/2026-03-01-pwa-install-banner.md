# PWA インストールバナー実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** スマートフォンでアプリのインストール方法が一目でわかる dismissible バナーをヘッダーに表示する。

**Architecture:** `useInstallBanner` フックが iOS 検出・スタンドアローン判定・バナー非表示記憶を担う。`InstallBanner` コンポーネントはそれを使い、Android は `beforeinstallprompt` API でネイティブプロンプトを起動、iOS Safari はダイアログで手順を案内する。バナーは `SpHeader`・`Header` の両方で既存バナー（GuestBanner）と同じ場所に追加する。

**Tech Stack:** React 19, Next.js 15, Tailwind CSS v4, shadcn/ui Dialog, Vitest + React Testing Library

---

### Task 1: `useInstallBanner` フック

iOS 検出・スタンドアローン判定・バナー非表示記憶を持つフックを作成する。

**Files:**
- Create: `apps/web/lib/hooks/use-install-banner.ts`
- Test: `apps/web/lib/__tests__/use-install-banner.test.ts`
- Reference (pattern): `apps/web/lib/hooks/use-install-prompt.ts`
- Reference (pattern): `apps/web/lib/__tests__/use-install-prompt.test.ts`

**背景知識:**
- `useInstallPrompt`（既存）は `beforeinstallprompt` イベントを捕捉する。Android Chrome のみで発火する。
- iOS Safari では `beforeinstallprompt` は永遠に発火しない。UA で iOS を検出して別フローにする。
- スタンドアローンモード（既にインストール済み）は `window.matchMedia('(display-mode: standalone)').matches` で検出。
- バナー非表示は `localStorage.setItem('install-banner-dismissed', '1')` で記憶する。
- SSR での hydration mismatch を防ぐため、`navigator`/`window` へのアクセスは `useEffect` 内で行う。`null` を初期値として「未マウント」を表現し、マウント前は `showBanner = false` にする。

**Step 1: テストを書く**

`apps/web/lib/__tests__/use-install-banner.test.ts` を作成:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInstallBanner } from "../hooks/use-install-banner";

describe("useInstallBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    // Default: Android Chrome, not standalone
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0",
    });
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("showBanner=false when already standalone (installed)", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(false);
  });

  it("showBanner=false when dismissed", () => {
    localStorage.setItem("install-banner-dismissed", "1");
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(false);
  });

  it("showBanner=false when no beforeinstallprompt and not iOS", () => {
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(false);
  });

  it("showBanner=true when beforeinstallprompt fires (Android)", () => {
    const { result } = renderHook(() => useInstallBanner());

    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });

    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(result.current.showBanner).toBe(true);
    expect(result.current.isIos).toBe(false);
  });

  it("showBanner=true and isIos=true on iOS Safari UA", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const { result } = renderHook(() => useInstallBanner());
    expect(result.current.showBanner).toBe(true);
    expect(result.current.isIos).toBe(true);
  });

  it("dismiss() hides banner and saves to localStorage", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const { result } = renderHook(() => useInstallBanner());

    expect(result.current.showBanner).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.showBanner).toBe(false);
    expect(localStorage.getItem("install-banner-dismissed")).toBe("1");
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/web test -- --run lib/__tests__/use-install-banner.test.ts
```

Expected: FAIL with "Cannot find module '../hooks/use-install-banner'"

**Step 3: フックを実装**

`apps/web/lib/hooks/use-install-banner.ts` を作成:

```ts
import { useCallback, useEffect, useState } from "react";
import { useInstallPrompt } from "./use-install-prompt";

const DISMISSED_KEY = "install-banner-dismissed";

// Must be called only in effects (window/navigator not available during SSR)
function detectIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function detectStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches;
}

type BannerState = {
  isIos: boolean;
  isStandalone: boolean;
  dismissed: boolean;
};

export function useInstallBanner() {
  const { canInstall, promptInstall } = useInstallPrompt();
  // null = not yet mounted (SSR-safe: renders nothing until client-side init)
  const [state, setState] = useState<BannerState | null>(null);

  useEffect(() => {
    setState({
      isIos: detectIos(),
      isStandalone: detectStandalone(),
      dismissed: localStorage.getItem(DISMISSED_KEY) === "1",
    });
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setState((prev) => (prev ? { ...prev, dismissed: true } : prev));
  }, []);

  if (!state) {
    return { showBanner: false, isIos: false, canInstall, promptInstall, dismiss };
  }

  const { isIos, isStandalone, dismissed } = state;
  const showBanner = !isStandalone && !dismissed && (canInstall || isIos);

  return { showBanner, isIos, canInstall, promptInstall, dismiss };
}
```

**Step 4: テストが通ることを確認**

```bash
bun run --filter @sugara/web test -- --run lib/__tests__/use-install-banner.test.ts
```

Expected: PASS (all 6 tests)

**Step 5: コミット**

```bash
git add apps/web/lib/hooks/use-install-banner.ts apps/web/lib/__tests__/use-install-banner.test.ts
git commit -m "feat: useInstallBanner フックを追加（iOS 検出・非表示記憶）"
```

---

### Task 2: `InstallBanner` コンポーネント

バナー UI と iOS 向け手順ダイアログを実装する。

**Files:**
- Create: `apps/web/components/install-banner.tsx`
- Reference (pattern): `apps/web/components/guest-banner.tsx`（バナーの色・構造のパターン）
- Reference (shadcn/ui): `apps/web/components/ui/dialog.tsx`（Dialog コンポーネントが既にある）

**バナーの仕様:**
- `showBanner === false` なら `null` を返す（レンダリングなし）
- Android (`isIos === false`, `canInstall === true`): 「ホーム画面に追加」ボタン → `promptInstall()` を呼ぶ
- iOS (`isIos === true`): 「追加方法を見る」ボタン → iOS 手順ダイアログを開く
- 右端に × ボタン → `dismiss()` を呼ぶ
- 色: `bg-blue-50 dark:bg-blue-950/30`（guest-banner の amber を青に置換）

**iOS 手順ダイアログの内容（3 ステップ）:**
1. 画面下部の「共有」ボタン（四角から上矢印）をタップ
2. 「ホーム画面に追加」をタップ
3. 右上の「追加」をタップ

**Step 1: コンポーネントを実装**

`apps/web/components/install-banner.tsx` を作成:

```tsx
"use client";

import { X } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInstallBanner } from "@/lib/hooks/use-install-banner";

export function InstallBanner() {
  const { showBanner, isIos, promptInstall, dismiss } = useInstallBanner();
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  if (!showBanner) return null;

  return (
    <>
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="container flex items-center justify-between gap-2 px-4 py-1.5 text-sm">
          <span className="text-blue-900 dark:text-blue-200">
            このアプリをホーム画面に追加できます
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {isIos ? (
              <button
                type="button"
                className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-blue-950 dark:hover:bg-blue-400"
                onClick={() => setIosDialogOpen(true)}
              >
                追加方法を見る
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-blue-950 dark:hover:bg-blue-400"
                onClick={promptInstall}
              >
                ホーム画面に追加
              </button>
            )}
            <button
              type="button"
              aria-label="バナーを閉じる"
              className="text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              onClick={dismiss}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ホーム画面に追加する方法</DialogTitle>
            <DialogDescription>
              Safari でこのページを開き、以下の手順で追加してください
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                1
              </span>
              <span>
                画面下部の{" "}
                <span className="inline-flex items-center rounded bg-muted px-1 font-mono text-xs">
                  共有
                </span>{" "}
                ボタン（四角から上矢印が出たアイコン）をタップ
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                2
              </span>
              <span>
                メニューをスクロールして{" "}
                <span className="font-medium">「ホーム画面に追加」</span> をタップ
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                3
              </span>
              <span>
                右上の <span className="font-medium">「追加」</span> をタップ
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 2: 全テストが通ることを確認**

```bash
bun run test
```

Expected: All tests pass (no regressions)

**Step 3: コミット**

```bash
git add apps/web/components/install-banner.tsx
git commit -m "feat: InstallBanner コンポーネントを追加（Android・iOS 対応）"
```

---

### Task 3: ヘッダーへの組み込み

`SpHeader` と `Header` の両方に `<InstallBanner />` を追加する。

**Files:**
- Modify: `apps/web/components/sp-header.tsx`
- Modify: `apps/web/components/header.tsx`

**既存のバナー挿入パターン（sp-header.tsx / header.tsx 共通）:**

```tsx
<header className="sticky top-0 z-30 select-none border-b bg-background">
  <OfflineBanner />
  <GuestBanner />
  {/* ← ここに <InstallBanner /> を追加 */}
  <nav ...>
```

**Step 1: sp-header.tsx を修正**

`apps/web/components/sp-header.tsx`:
1. import 群に `import { InstallBanner } from "@/components/install-banner";` を追加
2. `<GuestBanner />` の直後に `<InstallBanner />` を追加

**Step 2: header.tsx を修正**

`apps/web/components/header.tsx`:
1. import 群に `import { InstallBanner } from "@/components/install-banner";` を追加
2. `<GuestBanner />` の直後に `<InstallBanner />` を追加

**Step 3: 全テストが通ることを確認**

```bash
bun run test
```

Expected: All tests pass

**Step 4: コミット**

```bash
git add apps/web/components/sp-header.tsx apps/web/components/header.tsx
git commit -m "feat: SpHeader と Header に InstallBanner を組み込む"
```
