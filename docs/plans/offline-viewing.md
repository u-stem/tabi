# オフライン閲覧 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一度閲覧した旅行データをオフラインでも閲覧できるようにする

**Architecture:** `@tanstack/react-query-persist-client` + `idb-keyval` で React Query キャッシュを IndexedDB に自動永続化する。オフラインページを改善してキャッシュ済み旅行一覧を表示する。

**Tech Stack:** @tanstack/react-query-persist-client, idb-keyval, IndexedDB

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| Create | `apps/web/lib/idb-persister.ts` | IndexedDB persister の作成 |
| Create | `apps/web/lib/idb-persister.test.ts` | persister のテスト |
| Modify | `apps/web/lib/query-config.ts` | gcTime を24時間に延長 |
| Modify | `apps/web/lib/query-client.ts` | デフォルト gcTime の変更 |
| Modify | `apps/web/components/query-provider.tsx` | PersistQueryClientProvider に切り替え |
| Modify | `apps/web/app/offline/page.tsx` | Client Component 化、キャッシュ済み旅行一覧表示 |
| Modify | `apps/web/messages/ja.json` | メッセージ追加 |
| Modify | `apps/web/messages/en.json` | メッセージ追加 |

---

### Task 1: 依存関係の追加

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: パッケージを追加**

```bash
bun add --filter @sugara/web @tanstack/react-query-persist-client idb-keyval
```

- [ ] **Step 2: インストール確認**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore: react-query-persist-client と idb-keyval を追加"
```

---

### Task 2: gcTime の延長

**Files:**
- Modify: `apps/web/lib/query-config.ts`
- Modify: `apps/web/lib/query-client.ts`

- [ ] **Step 1: query-config.ts の gcTime を24時間に変更**

`apps/web/lib/query-config.ts` を以下に変更:

```typescript
// Centralized cache configuration for TanStack Query.
// dynamic: trips, schedules, polls — changes with user actions
// stable:  profile, friends, notification settings — changes infrequently
// static:  FAQs, announcements — rarely changes
//
// gcTime is set to 24 hours for all tiers to support offline viewing.
// Cached data persists in memory for a full day, and is also written to
// IndexedDB by the persister (see idb-persister.ts) for cross-session survival.
// staleTime controls when background refetch occurs while online.
const ONE_DAY = 24 * 60 * 60 * 1000;

export const QUERY_CONFIG = {
  dynamic: { staleTime: 15_000, gcTime: ONE_DAY },
  stable: { staleTime: 60_000, gcTime: ONE_DAY },
  static: { staleTime: 5 * 60_000, gcTime: ONE_DAY },
} as const;
```

`apps/web/lib/query-client.ts` は `QUERY_CONFIG.dynamic.gcTime` を参照しているので変更不要。

- [ ] **Step 2: 型チェック**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
git add apps/web/lib/query-config.ts
git commit -m "feat: React Query の gcTime を24時間に延長（オフライン閲覧対応）"
```

---

### Task 3: IndexedDB persister の実装

**Files:**
- Create: `apps/web/lib/idb-persister.ts`
- Create: `apps/web/lib/idb-persister.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// apps/web/lib/idb-persister.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock("idb-keyval", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  set: (...args: unknown[]) => mockSet(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

import { createIdbPersister } from "./idb-persister";

describe("createIdbPersister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("persistClient", () => {
    it("saves dehydrated state to IndexedDB", async () => {
      mockSet.mockResolvedValueOnce(undefined);
      const persister = createIdbPersister();
      const dehydratedState = { queries: [], mutations: [] };

      await persister.persistClient(dehydratedState);

      expect(mockSet).toHaveBeenCalledWith(
        "sugara-query-cache",
        dehydratedState,
      );
    });

    it("does not throw when IndexedDB write fails", async () => {
      mockSet.mockRejectedValueOnce(new Error("QuotaExceeded"));
      const persister = createIdbPersister();

      await expect(
        persister.persistClient({ queries: [], mutations: [] }),
      ).resolves.not.toThrow();
    });
  });

  describe("restoreClient", () => {
    it("restores dehydrated state from IndexedDB", async () => {
      const dehydratedState = { queries: [], mutations: [] };
      mockGet.mockResolvedValueOnce(dehydratedState);
      const persister = createIdbPersister();

      const result = await persister.restoreClient();

      expect(result).toEqual(dehydratedState);
    });

    it("returns undefined when no cache exists", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const persister = createIdbPersister();

      const result = await persister.restoreClient();

      expect(result).toBeUndefined();
    });

    it("returns undefined when IndexedDB read fails", async () => {
      mockGet.mockRejectedValueOnce(new Error("NotFound"));
      const persister = createIdbPersister();

      const result = await persister.restoreClient();

      expect(result).toBeUndefined();
    });
  });

  describe("removeClient", () => {
    it("deletes cache from IndexedDB", async () => {
      mockDel.mockResolvedValueOnce(undefined);
      const persister = createIdbPersister();

      await persister.removeClient();

      expect(mockDel).toHaveBeenCalledWith("sugara-query-cache");
    });

    it("does not throw when IndexedDB delete fails", async () => {
      mockDel.mockRejectedValueOnce(new Error("NotFound"));
      const persister = createIdbPersister();

      await expect(persister.removeClient()).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/web test -- idb-persister`
Expected: FAIL (module not found)

- [ ] **Step 3: persister を実装**

```typescript
// apps/web/lib/idb-persister.ts
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

const CACHE_KEY = "sugara-query-cache";

export function createIdbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(CACHE_KEY, client);
      } catch {
        // Quota exceeded or private browsing — silently skip
      }
    },

    restoreClient: async () => {
      try {
        return await get<PersistedClient>(CACHE_KEY);
      } catch {
        return undefined;
      }
    },

    removeClient: async () => {
      try {
        await del(CACHE_KEY);
      } catch {
        // Already gone or private browsing — ignore
      }
    },
  };
}
```

Note: `@tanstack/react-query-persist-client` の `PersistQueryClientProvider` は `maxAge` オプションを受け取り、内部で `dehydrate` 時の `buster` とタイムスタンプを使って期限切れ判定を行う。persister 側で独自に maxAge を管理する必要はない。

- [ ] **Step 4: テストが通ることを確認**

Run: `bun run --filter @sugara/web test -- idb-persister`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/web/lib/idb-persister.ts apps/web/lib/idb-persister.test.ts
git commit -m "feat: IndexedDB persister を追加（React Query キャッシュ永続化）"
```

---

### Task 4: QueryProvider を PersistQueryClientProvider に切り替え

**Files:**
- Modify: `apps/web/components/query-provider.tsx`

- [ ] **Step 1: QueryProvider を更新**

`apps/web/components/query-provider.tsx` を以下に変更:

```typescript
"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { createIdbPersister } from "@/lib/idb-persister";
import { createQueryClient } from "@/lib/query-client";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [persistOptions] = useState(() => ({
    persister: createIdbPersister(),
    maxAge: SEVEN_DAYS,
  }));

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 3: 既存テストが通ることを確認**

Run: `bun run --filter @sugara/web test`
Expected: PASS（既存テストに影響がないことを確認）

- [ ] **Step 4: コミット**

```bash
git add apps/web/components/query-provider.tsx
git commit -m "feat: QueryProvider を PersistQueryClientProvider に切り替え"
```

---

### Task 5: オフラインページの改善

**Files:**
- Modify: `apps/web/app/offline/page.tsx`
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: メッセージを追加**

`apps/web/messages/ja.json` の `"common"` セクションに追加:

```json
"cachedTrips": "閲覧可能な旅行"
```

`apps/web/messages/en.json` の `"common"` セクションに追加:

```json
"cachedTrips": "Available trips"
```

- [ ] **Step 2: オフラインページを Client Component に変更**

`apps/web/app/offline/page.tsx` を以下に変更:

```typescript
"use client";

import type { TripListItem } from "@sugara/shared";
import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { idbPersister } from "@/lib/idb-persister";
import { pageTitle } from "@/lib/constants";

export default function OfflinePage() {
  const tc = useTranslations("common");
  const [trips, setTrips] = useState<TripListItem[]>([]);

  useEffect(() => {
    document.title = pageTitle(tc("offline"));
  }, [tc]);

  useEffect(() => {
    async function loadCachedTrips() {
      try {
        const persisted = await restoreCachedTrips();
        setTrips(persisted);
      } catch {
        // IndexedDB not available
      }
    }
    loadCachedTrips();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 px-4 pt-16">
      <div className="text-center">
        <WifiOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-medium">{tc("offline")}</p>
        <p className="mt-2 text-muted-foreground text-sm">
          {tc("offlineRetry")}
        </p>
      </div>

      {trips.length > 0 && (
        <div className="mt-4 w-full max-w-sm">
          <h2 className="mb-3 font-medium text-muted-foreground text-sm">
            {tc("cachedTrips")}
          </h2>
          <div className="flex flex-col gap-2">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <p className="font-medium">{trip.title}</p>
                {trip.destination && (
                  <p className="text-muted-foreground text-sm">
                    {trip.destination}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function restoreCachedTrips(): Promise<TripListItem[]> {
  // Read persisted React Query cache directly from IndexedDB
  const { get } = await import("idb-keyval");
  const persisted = await get<{ clientState: { queries: Array<{ queryKey: readonly string[]; state: { data: unknown } }> } }>("sugara-query-cache");
  if (!persisted?.clientState?.queries) return [];

  const ownedQuery = persisted.clientState.queries.find(
    (q) => q.queryKey[0] === "trips" && q.queryKey[1] === "owned",
  );
  const sharedQuery = persisted.clientState.queries.find(
    (q) => q.queryKey[0] === "trips" && q.queryKey[1] === "shared",
  );

  const owned = (ownedQuery?.state?.data as TripListItem[] | undefined) ?? [];
  const shared = (sharedQuery?.state?.data as TripListItem[] | undefined) ?? [];

  return [...owned, ...shared].sort((a, b) =>
    (b.updatedAt ?? "") > (a.updatedAt ?? "") ? 1 : -1,
  );
}
```

Note: `/offline` ページは Service Worker のフォールバックとして使われる。このページは `PersistQueryClientProvider` の外（QueryClient が復元される前）に表示される可能性があるため、`useQueryClient` ではなく `idb-keyval` から直接 IndexedDB を読む。`PersistedClient` の内部構造（`clientState.queries`）にアクセスしている点に注意。

- [ ] **Step 3: 型チェック**

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 4: 動作確認**

`bun run --filter @sugara/web dev` でサーバーを起動し:
1. ホームページで旅行一覧を表示（IndexedDB にキャッシュが書き込まれる）
2. DevTools > Application > IndexedDB で `sugara-query-cache` が存在することを確認
3. DevTools > Network > Offline にして `/offline` にアクセス
4. キャッシュ済み旅行一覧が表示されることを確認

- [ ] **Step 5: コミット**

```bash
git add apps/web/app/offline/page.tsx apps/web/messages/ja.json apps/web/messages/en.json
git commit -m "feat: オフラインページでキャッシュ済み旅行一覧を表示"
```

---

### Task 6: FAQ・お知らせ更新

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`
- Create: `apps/web/content/news/ja/2026-03-31-offline-viewing.md`
- Create: `apps/web/content/news/en/2026-03-31-offline-viewing.md`

- [ ] **Step 1: FAQを追加**

`apps/api/src/db/seed-faqs.ts` の `JA_FAQS` で `sortOrder: 25` の後に追加:

```typescript
{
  question: "オフラインでも旅行を確認できますか？",
  answer:
    "はい。一度表示した旅行データはブラウザに保存され、オフラインでも閲覧できます。PWAとしてインストールしている場合に最適です。データは最大7日間保持されます。",
  sortOrder: 26,
},
```

`EN_FAQS` の同じ位置に追加:

```typescript
{
  question: "Can I view trips offline?",
  answer:
    "Yes. Trip data you've viewed is saved in the browser and can be accessed offline. It works best when sugara is installed as a PWA. Data is kept for up to 7 days.",
  sortOrder: 26,
},
```

`resolveCategory` の trips 範囲を `21-26` に更新:

```typescript
if (sortOrder >= 21 && sortOrder <= 26) return "trips";
```

- [ ] **Step 2: お知らせ記事を作成**

既存のお知らせ記事のフォーマットに合わせて ja/en 両方に作成する。

- [ ] **Step 3: FAQシードを実行**

Run: `bun run --filter @sugara/api db:seed-faqs`

- [ ] **Step 4: コミット**

```bash
git add apps/api/src/db/seed-faqs.ts apps/web/content/news/ja/2026-03-31-offline-viewing.md apps/web/content/news/en/2026-03-31-offline-viewing.md
git commit -m "docs: オフライン閲覧機能のFAQとお知らせを追加"
```
