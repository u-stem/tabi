# Offline PWA Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `@serwist/turbopack` を `@serwist/next` に移行し、Next.js ビルド時にプリキャッシュ manifest を生成することでオフライン時のアイコン・UI コンポーネントのロード問題を解消する。

**Architecture:** `@serwist/next` の webpack プラグインが `next build` 時に全静的アセット（`_next/static/**`）のリストを生成し `public/sw.js` に埋め込む。SW インストール時に全アセットをプリキャッシュし、以降はオフラインでも動作する。ナビゲーションに `networkTimeoutSeconds: 3` を設定して無限ロードを防ぐ。

**Tech Stack:** `@serwist/next` v9, `serwist` v9, Next.js 15 App Router

---

## 作業前の確認

```bash
# 現在のパッケージバージョン確認
grep -E "@serwist|serwist" apps/web/package.json

# public/sw.js が gitignore 対象であることを確認（未追跡のビルド成果物）
git ls-files apps/web/public/sw.js
# Expected: 出力なし（未追跡）
```

---

### Task 1: パッケージ入れ替え

**Files:**
- Modify: `apps/web/package.json`

**Step 1: `@serwist/next` をインストールし `@serwist/turbopack` を削除**

```bash
bun add --filter @sugara/web @serwist/next
bun remove --filter @sugara/web @serwist/turbopack
```

**Step 2: インストール確認**

```bash
grep -E "@serwist" apps/web/package.json
```

Expected: `@serwist/next` が dependencies に存在し、`@serwist/turbopack` が消えていること。

**Step 3: `@serwist/next` の export 形式を確認**

```bash
# node_modules 内の型定義を確認して API シグネチャを把握する
head -50 node_modules/@serwist/next/dist/index.d.ts 2>/dev/null || \
  cat node_modules/@serwist/next/index.d.ts 2>/dev/null | head -50
```

デフォルトエクスポートか named export かを確認し、次のタスクのコードを調整すること。

---

### Task 2: `app/serwist/[path]/route.ts` を削除

**Files:**
- Delete: `apps/web/app/serwist/[path]/route.ts`

**Step 1: ファイルを削除**

```bash
rm apps/web/app/serwist/\[path\]/route.ts
rmdir apps/web/app/serwist/\[path\]/
rmdir apps/web/app/serwist/
```

このファイルは `@serwist/turbopack` 専用の API Route で、`@serwist/next` では SW を静的ファイル (`public/sw.js`) として配信するため不要。

---

### Task 3: `next.config.ts` を更新

**Files:**
- Modify: `apps/web/next.config.ts`

**Step 1: import を変更し、`withSerwist` の設定を追加**

```typescript
// 変更前
import { withSerwist } from "@serwist/turbopack";

// 変更後
import withSerwist from "@serwist/next";
```

`export default` の行も変更:

```typescript
// 変更前
export default withSerwist(nextConfig);

// 変更後
export default withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Bump revision when app/offline/page.tsx content changes
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
})(nextConfig);
```

`additionalPrecacheEntries` で `/offline` ページを明示的にプリキャッシュ対象に追加。`revision: "1"` はオフラインページの内容が変わったときに手動で更新する。

---

### Task 4: `app/sw.ts` を更新

**Files:**
- Modify: `apps/web/app/sw.ts`

**Step 1: import を変更し、ナビゲーションタイムアウトを追加**

```typescript
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { NetworkFirst } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // defaultCache より前に置くことで、navigation リクエストにタイムアウトを追加
    // オフライン時に 3 秒でキャッシュにフォールバックし、無限ロードを防ぐ
    {
      matcher: ({ request }: { request: Request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "navigations",
        networkTimeoutSeconds: 3,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    document: "/offline",
  },
});

serwist.addEventListeners();
```

`defaultCache` から `@serwist/next/worker` に変更。`defaultCache` には `_next/static/` への CacheFirst が含まれる。navigation ハンドラは `defaultCache` の前に置くことで override する（Serwist は最初にマッチしたルールを使用するため）。

---

### Task 5: `components/sw-provider.tsx` を更新

**Files:**
- Modify: `apps/web/components/sw-provider.tsx`

**Step 1: `@serwist/turbopack/react` 依存を除去し、シンプルな登録処理に変更**

```typescript
"use client";

import { useEffect } from "react";

export function SwProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // SW はビルド時にのみ生成されるため、本番環境のみ登録
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }
  }, []);

  return <>{children}</>;
}
```

`@serwist/turbopack/react` の `SerwistProvider` は turbopack 専用のため置き換え。`children` を受け取る点は同じなので `app/layout.tsx` の変更は最小限。

---

### Task 6: `app/layout.tsx` を更新

**Files:**
- Modify: `apps/web/app/layout.tsx`

**Step 1: `swUrl` prop を削除**

```tsx
// 変更前
<SwProvider swUrl="/serwist/sw.js">

// 変更後
<SwProvider>
```

`SwProvider` の型が変わるため、`swUrl` prop を渡していた箇所を削除する。

---

### Task 7: `app/offline/page.tsx` を作成

**Files:**
- Create: `apps/web/app/offline/page.tsx`

**Step 1: シンプルなオフラインフォールバックページを作成**

```tsx
import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { pageTitle } from "@/lib/constants";

export const metadata: Metadata = {
  title: pageTitle("オフライン"),
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <WifiOff className="h-10 w-10 text-muted-foreground" />
      <p className="text-lg font-medium">オフラインです</p>
      <p className="text-sm text-muted-foreground">
        インターネット接続を確認してから再度お試しください
      </p>
    </div>
  );
}
```

---

### Task 8: テストを追加

**Files:**
- Create: `apps/web/lib/__tests__/sw-provider.test.tsx`

**Step 1: テストを作成**

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SwProvider } from "../../components/sw-provider";

describe("SwProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("renders children", () => {
    render(
      <SwProvider>
        <p>child content</p>
      </SwProvider>,
    );
    expect(screen.getByText("child content")).toBeDefined();
  });

  it("does not register SW outside production", () => {
    const registerMock = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: registerMock },
      configurable: true,
    });
    // NODE_ENV is "test" in vitest, not "production"
    render(<SwProvider><p>child</p></SwProvider>);
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("registers /sw.js in production", () => {
    const registerMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: registerMock },
      configurable: true,
    });
    vi.stubEnv("NODE_ENV", "production");
    render(<SwProvider><p>child</p></SwProvider>);
    expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });
});
```

**Step 2: テストを実行**

```bash
bun run --filter @sugara/web test
```

Expected: 全テスト PASS。

---

### Task 9: 型チェックと最終確認

**Step 1: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし。

**Step 2: lint チェック**

```bash
bun run check
```

Expected: エラーなし（warning は許容）。

**Step 3: コミット**

```bash
git add apps/web/
git commit -m "feat(web): @serwist/nextに移行してオフライン時のアセットキャッシュを修正"
```

---

## 注意事項

- `public/sw.js` はビルド時に `@serwist/next` が生成する。開発中 (`next dev --turbopack`) は SW が生成されないため、`SwProvider` は本番のみ登録する。
- 既存ユーザーは旧 SW (`/serwist/sw.js`) を持つが、新旧は登録スコープが異なる（`/serwist/` vs `/`）ため競合しない。旧 SW は次回のアクティベーション時にスコープ外となり、自然に無効化される。
- `additionalPrecacheEntries` の `revision` は `/offline` ページの内容を変更した際に手動インクリメントが必要。
