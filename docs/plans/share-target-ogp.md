# URL共有改善: Web Share Target + OGP自動入力 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホブラウザの共有シートから候補を追加できるようにし、フォーム内URL入力時にOGPタイトルを自動取得する

**Architecture:** サーバーサイドにOGP取得エンドポイントを追加し、Web Share Target ページとフォームの両方から利用する。Share Target は PWA manifest に `share_target` を追加し、専用ページで旅行選択 -> 候補追加を行う。

**Tech Stack:** Hono (API), Next.js 16 (Share Target page), Zod (validation), React Query (cache)

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| Create | `packages/shared/src/schemas/ogp.ts` | OGPリクエスト/レスポンスのZodスキーマ |
| Create | `apps/api/src/lib/ogp.ts` | OGPタイトル取得ロジック |
| Create | `apps/api/src/lib/ogp.test.ts` | OGP取得ロジックのユニットテスト |
| Create | `apps/api/src/routes/ogp.ts` | OGP APIルート |
| Create | `apps/api/src/routes/ogp.test.ts` | OGP APIルートのテスト |
| Modify | `packages/shared/src/schemas/index.ts` | ogpスキーマのエクスポート追加 |
| Modify | `apps/api/src/app.ts` | ogpルートの登録 |
| Create | `apps/web/app/share-target/page.tsx` | Share Target ページ |
| Create | `apps/web/components/share-target-content.tsx` | Share Target のクライアントコンポーネント |
| Modify | `apps/web/app/manifest.ts` | `share_target` 追加 |
| Create | `apps/web/lib/hooks/use-ogp-autofill.ts` | URL入力時のOGP自動取得hook |
| Create | `apps/web/lib/hooks/use-ogp-autofill.test.ts` | hookのテスト |
| Modify | `apps/web/components/schedule-form-fields.tsx` | OGP自動入力の統合 |
| Modify | `apps/web/messages/ja.json` | 日本語メッセージ追加 |
| Modify | `apps/web/messages/en.json` | 英語メッセージ追加 |

---

### Task 1: OGP Zodスキーマ

**Files:**
- Create: `packages/shared/src/schemas/ogp.ts`
- Modify: `packages/shared/src/schemas/index.ts`

- [ ] **Step 1: OGPスキーマを作成**

```typescript
// packages/shared/src/schemas/ogp.ts
import { z } from "zod";

export const ogpRequestSchema = z.object({
  url: z.string().url().refine((v) => new URL(v).protocol === "https:", "Only HTTPS URLs are allowed"),
});

export const ogpResponseSchema = z.object({
  title: z.string(),
});

export type OgpRequest = z.infer<typeof ogpRequestSchema>;
export type OgpResponse = z.infer<typeof ogpResponseSchema>;
```

- [ ] **Step 2: index.tsにエクスポートを追加**

`packages/shared/src/schemas/index.ts` に以下を追加:

```typescript
export { ogpRequestSchema, ogpResponseSchema, type OgpRequest, type OgpResponse } from "./ogp";
```

- [ ] **Step 3: 型チェック**

Run: `bun run --filter @sugara/shared check-types`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add packages/shared/src/schemas/ogp.ts packages/shared/src/schemas/index.ts
git commit -m "feat: OGPリクエスト/レスポンスのZodスキーマを追加"
```

---

### Task 2: OGPタイトル取得ロジック

**Files:**
- Create: `apps/api/src/lib/ogp.ts`
- Create: `apps/api/src/lib/ogp.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// apps/api/src/lib/ogp.test.ts
import { describe, expect, it } from "vitest";
import { extractTitle, titleFromUrl } from "./ogp";

describe("extractTitle", () => {
  it("extracts og:title from HTML", () => {
    const html = '<html><head><meta property="og:title" content="My Page Title" /></head></html>';
    expect(extractTitle(html)).toBe("My Page Title");
  });

  it("falls back to title tag when og:title is missing", () => {
    const html = "<html><head><title>Fallback Title</title></head></html>";
    expect(extractTitle(html)).toBe("Fallback Title");
  });

  it("returns null when no title is found", () => {
    const html = "<html><head></head><body>Hello</body></html>";
    expect(extractTitle(html)).toBeNull();
  });

  it("decodes HTML entities in extracted title", () => {
    const html = '<html><head><meta property="og:title" content="Title &amp; More" /></head></html>';
    expect(extractTitle(html)).toBe("Title & More");
  });

  it("handles single-quoted og:title attribute", () => {
    const html = "<html><head><meta property='og:title' content='Single Quoted' /></head></html>";
    expect(extractTitle(html)).toBe("Single Quoted");
  });

  it("prefers og:title over title tag", () => {
    const html = '<html><head><meta property="og:title" content="OG Title" /><title>Title Tag</title></head></html>';
    expect(extractTitle(html)).toBe("OG Title");
  });
});

describe("titleFromUrl", () => {
  it("generates title from URL when extraction fails", () => {
    expect(titleFromUrl("https://example.com/path/to/page")).toBe("example.com/path/to/page");
  });

  it("removes trailing slash", () => {
    expect(titleFromUrl("https://example.com/")).toBe("example.com");
  });

  it("handles URL with query params", () => {
    expect(titleFromUrl("https://example.com/search?q=test")).toBe("example.com/search");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/api test -- ogp.test`
Expected: FAIL (module not found)

- [ ] **Step 3: 実装**

```typescript
// apps/api/src/lib/ogp.ts
const OG_TITLE_RE = /< *meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i;
const OG_TITLE_RE_ALT = /< *meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i;
const TITLE_TAG_RE = /<title[^>]*>([^<]+)<\/title>/i;

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&#x2F;": "/",
};
const ENTITY_RE = /&(?:amp|lt|gt|quot|#39|#x27|#x2F);/g;

function decodeEntities(s: string): string {
  return s.replace(ENTITY_RE, (m) => HTML_ENTITIES[m] ?? m);
}

export function extractTitle(html: string): string | null {
  const ogMatch = html.match(OG_TITLE_RE) ?? html.match(OG_TITLE_RE_ALT);
  if (ogMatch) return decodeEntities(ogMatch[1].trim());

  const titleMatch = html.match(TITLE_TAG_RE);
  if (titleMatch) return decodeEntities(titleMatch[1].trim());

  return null;
}

export function titleFromUrl(url: string): string {
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.hostname}${path}`;
}

// Block SSRF: private/reserved IPs
const PRIVATE_IP_RE =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|::1|fc|fd|fe80)/;

export async function fetchOgpTitle(url: string): Promise<string> {
  const parsed = new URL(url);

  if (PRIVATE_IP_RE.test(parsed.hostname)) {
    return titleFromUrl(url);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "sugara-bot/1.0",
        Accept: "text/html",
      },
      redirect: "follow",
    });

    if (!res.ok || !res.headers.get("content-type")?.includes("text/html")) {
      return titleFromUrl(url);
    }

    // Read only first 16KB
    const reader = res.body?.getReader();
    if (!reader) return titleFromUrl(url);

    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const MAX_BYTES = 16 * 1024;

    while (totalSize < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalSize += value.length;
    }
    reader.cancel();

    const html = new TextDecoder().decode(
      chunks.length === 1 ? chunks[0] : concatUint8Arrays(chunks, totalSize),
    );

    return extractTitle(html) ?? titleFromUrl(url);
  } catch {
    return titleFromUrl(url);
  } finally {
    clearTimeout(timeout);
  }
}

function concatUint8Arrays(arrays: Uint8Array[], totalLength: number): Uint8Array {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bun run --filter @sugara/api test -- ogp.test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/api/src/lib/ogp.ts apps/api/src/lib/ogp.test.ts
git commit -m "feat: OGPタイトル取得ロジックを追加"
```

---

### Task 3: OGP APIルート

**Files:**
- Create: `apps/api/src/routes/ogp.ts`
- Create: `apps/api/src/routes/ogp.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: テストを書く**

既存のルートテスト (`apps/api/src/routes/exchange-rate.test.ts` など) のパターンを確認し、同じ構造で書く。テストヘルパー (`apps/api/src/test-helpers.ts`) の認証済みクライアントを使う。

```typescript
// apps/api/src/routes/ogp.test.ts
import { describe, expect, it } from "vitest";
// Import test client following existing test pattern in this project

describe("GET /api/ogp", () => {
  it("returns 400 for missing url parameter", async () => {
    // Call GET /api/ogp without url param
    // Expect: 400
  });

  it("returns 400 for non-HTTPS url", async () => {
    // Call GET /api/ogp?url=http://example.com
    // Expect: 400
  });

  it("returns 400 for invalid url", async () => {
    // Call GET /api/ogp?url=not-a-url
    // Expect: 400
  });

  it("returns title for valid HTTPS url", async () => {
    // Call GET /api/ogp?url=https://example.com
    // Expect: 200, { title: string }
  });
});
```

Note: テストヘルパーのパターンは `apps/api/src/routes/exchange-rate.test.ts` や `apps/api/src/routes/discord-webhook.test.ts` を参照して合わせること。認証が必要なエンドポイントなので、テストヘルパーが提供する認証済みのリクエスト方法を使う。

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/api test -- ogp.test`
Expected: FAIL

- [ ] **Step 3: ルートを実装**

```typescript
// apps/api/src/routes/ogp.ts
import { ogpRequestSchema } from "@sugara/shared";
import { Hono } from "hono";
import { fetchOgpTitle } from "../lib/ogp";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const ogpRoutes = new Hono<AppEnv>();
ogpRoutes.use("*", requireAuth);

ogpRoutes.get("/ogp", async (c) => {
  const url = c.req.query("url") ?? "";
  const parsed = ogpRequestSchema.safeParse({ url });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const title = await fetchOgpTitle(parsed.data.url);
  return c.json({ title });
});

export { ogpRoutes };
```

- [ ] **Step 4: app.tsにルートを登録**

`apps/api/src/app.ts` の既存ルート登録部分に追加:

```typescript
import { ogpRoutes } from "./routes/ogp";

// 他の /api ベースのルート登録の近くに追加
app.route("/api", ogpRoutes);
```

- [ ] **Step 5: テストが通ることを確認**

Run: `bun run --filter @sugara/api test -- ogp`
Expected: PASS

- [ ] **Step 6: 型チェック**

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add apps/api/src/routes/ogp.ts apps/api/src/routes/ogp.test.ts apps/api/src/app.ts
git commit -m "feat: OGP取得APIエンドポイントを追加"
```

---

### Task 4: Web Share Target - manifest 更新

**Files:**
- Modify: `apps/web/app/manifest.ts`

- [ ] **Step 1: manifestにshare_targetを追加**

`apps/web/app/manifest.ts` を編集。`share_target` を追加する:

```typescript
share_target: {
  action: "/share-target",
  method: "GET",
  params: {
    url: "url",
    title: "title",
    text: "text",
  },
},
```

Note: Next.js の `MetadataRoute.Manifest` 型に `share_target` が含まれていない可能性がある。その場合は戻り値の型を `MetadataRoute.Manifest & { share_target: object }` に変更するか、`as` でアサーションする。実際の型定義を確認して判断すること。

- [ ] **Step 2: 型チェック**

Run: `bun run --filter @sugara/web check-types`
Expected: PASS (型エラーがあれば対応)

- [ ] **Step 3: コミット**

```bash
git add apps/web/app/manifest.ts
git commit -m "feat: PWA manifestにshare_targetを追加"
```

---

### Task 5: Web Share Target - ページ実装

**Files:**
- Create: `apps/web/app/share-target/page.tsx`
- Create: `apps/web/components/share-target-content.tsx`
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: メッセージを追加**

`apps/web/messages/ja.json` のトップレベルに追加:

```json
"shareTarget": {
  "title": "候補に追加",
  "adding": "追加中...",
  "selectTrip": "追加先の旅行を選択",
  "noActiveTrips": "進行中の旅行がありません",
  "goHome": "ホームに戻る",
  "invalidUrl": "共有されたURLが無効です",
  "added": "候補を追加しました",
  "addFailed": "候補の追加に失敗しました"
}
```

`apps/web/messages/en.json` のトップレベルに追加:

```json
"shareTarget": {
  "title": "Add to Candidates",
  "adding": "Adding...",
  "selectTrip": "Select a trip",
  "noActiveTrips": "No active trips",
  "goHome": "Go to Home",
  "invalidUrl": "The shared URL is invalid",
  "added": "Candidate added",
  "addFailed": "Failed to add candidate"
}
```

- [ ] **Step 2: サーバーコンポーネント (page.tsx) を作成**

```typescript
// apps/web/app/share-target/page.tsx
import { ShareTargetContent } from "@/components/share-target-content";

type Props = {
  searchParams: Promise<{ url?: string; title?: string; text?: string }>;
};

export default async function ShareTargetPage({ searchParams }: Props) {
  const params = await searchParams;
  return <ShareTargetContent url={params.url} title={params.title} text={params.text} />;
}
```

- [ ] **Step 3: クライアントコンポーネントを作成**

```typescript
// apps/web/components/share-target-content.tsx
"use client";

import type { TripListItem } from "@sugara/shared";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type Props = {
  url?: string;
  title?: string;
  text?: string;
};

function extractUrlFromText(text: string): string | null {
  const match = text.match(/https:\/\/\S+/);
  return match ? match[0] : null;
}

export function ShareTargetContent({ url, title, text }: Props) {
  const t = useTranslations("shareTarget");
  const router = useRouter();
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const resolvedUrl = useMemo(() => {
    if (url) return url;
    if (text) return extractUrlFromText(text);
    return null;
  }, [url, text]);

  const addCandidate = useCallback(
    async (tripId: string) => {
      if (!resolvedUrl) return;
      setAdding(true);
      try {
        const { title: ogpTitle } = await api<{ title: string }>("/api/ogp", {
          params: { url: resolvedUrl },
        });

        const name = ogpTitle || title || resolvedUrl;

        await api(`/api/trips/${tripId}/candidates`, {
          method: "POST",
          body: JSON.stringify({
            name: name.slice(0, 200),
            category: "other" as const,
            color: "blue" as const,
            urls: [resolvedUrl],
          }),
        });

        toast.success(t("added"));
        router.push(`/trips/${tripId}`);
      } catch {
        toast.error(t("addFailed"));
        setAdding(false);
      }
    },
    [resolvedUrl, title, t, router],
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchTrips() {
      try {
        const [owned, shared] = await Promise.all([
          api<TripListItem[]>("/api/trips?scope=owned"),
          api<TripListItem[]>("/api/trips?scope=shared"),
        ]);
        const active = [...owned, ...shared].filter((t) => t.status !== "completed");

        if (cancelled) return;
        setTrips(active);

        if (active.length === 1 && resolvedUrl) {
          await addCandidate(active[0].id);
        }
      } catch {
        if (cancelled) return;
        const returnParams = new URLSearchParams();
        if (url) returnParams.set("url", url);
        if (title) returnParams.set("title", title);
        if (text) returnParams.set("text", text);
        const returnUrl = `/share-target?${returnParams.toString()}`;
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(returnUrl)}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTrips();
    return () => { cancelled = true; };
  }, []); // Run once on mount

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!resolvedUrl) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">{t("invalidUrl")}</p>
        <Button onClick={() => router.push("/home")}>{t("goHome")}</Button>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground">{t("noActiveTrips")}</p>
        <Button onClick={() => router.push("/home")}>{t("goHome")}</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="font-semibold text-lg">{t("selectTrip")}</h1>
      <div className="flex w-full max-w-sm flex-col gap-2">
        {trips.map((trip) => (
          <button
            key={trip.id}
            type="button"
            disabled={adding}
            className="rounded-lg border p-4 text-left transition-colors hover:bg-accent disabled:opacity-50"
            onClick={() => addCandidate(trip.id)}
          >
            <p className="font-medium">{trip.title}</p>
            {trip.destination && (
              <p className="text-muted-foreground text-sm">{trip.destination}</p>
            )}
          </button>
        ))}
      </div>
      {adding && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("adding")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 型チェック**

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 5: 動作確認**

`bun run --filter @sugara/web dev` でサーバーを起動し、ブラウザで以下にアクセス:
- `/share-target?url=https%3A%2F%2Fexample.com` - 旅行選択画面 or 即追加
- `/share-target` - 「URLが無効」メッセージ
- `/share-target?text=Check%20this%20https%3A%2F%2Fexample.com` - textからURL抽出

- [ ] **Step 6: コミット**

```bash
git add apps/web/app/share-target/page.tsx apps/web/components/share-target-content.tsx apps/web/messages/ja.json apps/web/messages/en.json
git commit -m "feat: Web Share Targetページを追加"
```

---

### Task 6: OGP自動入力hook

**Files:**
- Create: `apps/web/lib/hooks/use-ogp-autofill.ts`
- Create: `apps/web/lib/hooks/use-ogp-autofill.test.ts`

- [ ] **Step 1: テストを書く**

```typescript
// apps/web/lib/hooks/use-ogp-autofill.test.ts
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOgpAutofill } from "./use-ogp-autofill";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}));

import { api } from "@/lib/api";
const mockApi = vi.mocked(api);

describe("useOgpAutofill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when URL is empty", () => {
    const onTitleFetched = vi.fn();
    renderHook(() => useOgpAutofill({ url: "", name: "", onTitleFetched }));
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("does not fetch when name is already filled", () => {
    const onTitleFetched = vi.fn();
    renderHook(() =>
      useOgpAutofill({ url: "https://example.com", name: "Existing", onTitleFetched }),
    );
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("does not fetch for non-HTTPS URLs", () => {
    const onTitleFetched = vi.fn();
    renderHook(() =>
      useOgpAutofill({ url: "http://example.com", name: "", onTitleFetched }),
    );
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("fetches OGP title when URL is valid and name is empty", async () => {
    mockApi.mockResolvedValueOnce({ title: "Fetched Title" });
    const onTitleFetched = vi.fn();

    renderHook(() =>
      useOgpAutofill({ url: "https://example.com", name: "", onTitleFetched }),
    );

    await waitFor(() => {
      expect(onTitleFetched).toHaveBeenCalledWith("Fetched Title");
    });
  });

  it("does not call onTitleFetched when fetch fails", async () => {
    mockApi.mockRejectedValueOnce(new Error("Network error"));
    const onTitleFetched = vi.fn();

    renderHook(() =>
      useOgpAutofill({ url: "https://example.com", name: "", onTitleFetched }),
    );

    await new Promise((r) => setTimeout(r, 700));
    expect(onTitleFetched).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/web test -- use-ogp-autofill`
Expected: FAIL (module not found)

- [ ] **Step 3: hookを実装**

```typescript
// apps/web/lib/hooks/use-ogp-autofill.ts
import { useEffect, useRef } from "react";
import { api } from "@/lib/api";

type UseOgpAutofillParams = {
  url: string;
  name: string;
  onTitleFetched: (title: string) => void;
};

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function useOgpAutofill({ url, name, onTitleFetched }: UseOgpAutofillParams) {
  const fetchedUrlRef = useRef<string>("");
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!url || name || !isValidHttpsUrl(url)) return;
    if (url === fetchedUrlRef.current) return;
    if (loadingRef.current) return;

    const timer = setTimeout(async () => {
      loadingRef.current = true;
      try {
        const { title } = await api<{ title: string }>("/api/ogp", {
          params: { url },
        });
        fetchedUrlRef.current = url;
        if (title) {
          onTitleFetched(title);
        }
      } catch {
        // Silently fail - user can type manually
      } finally {
        loadingRef.current = false;
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [url, name, onTitleFetched]);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bun run --filter @sugara/web test -- use-ogp-autofill`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add apps/web/lib/hooks/use-ogp-autofill.ts apps/web/lib/hooks/use-ogp-autofill.test.ts
git commit -m "feat: URL入力時のOGP自動取得hookを追加"
```

---

### Task 7: ScheduleFormFieldsにOGP自動入力を統合

**Files:**
- Modify: `apps/web/components/schedule-form-fields.tsx`

- [ ] **Step 1: ScheduleFormFieldsにhookを統合**

`apps/web/components/schedule-form-fields.tsx` を編集:

1. import追加:
```typescript
import { useOgpAutofill } from "@/lib/hooks/use-ogp-autofill";
```

2. `ScheduleFormFields` コンポーネント内、`name` state 定義の後に追加:

```typescript
const handleOgpTitle = useCallback(
  (title: string) => {
    if (!nameRef.current) {
      setName(title.slice(0, SCHEDULE_NAME_MAX_LENGTH));
    }
  },
  [],
);

const firstUrl = urls.find((u) => u.trim() !== "") ?? "";
useOgpAutofill({
  url: firstUrl,
  name,
  onTitleFetched: handleOgpTitle,
});
```

`nameRef` は既に存在している (`apps/web/components/schedule-form-fields.tsx:106`)。`useCallback` は既にインポート済み。

- [ ] **Step 2: 型チェック**

Run: `bun run check-types`
Expected: PASS

- [ ] **Step 3: 動作確認**

`bun run --filter @sugara/web dev` でサーバーを起動し:
1. 候補追加ダイアログを開く
2. URL欄に `https://example.com` を貼り付ける
3. 500ms後に名前欄にOGPタイトルが自動入力される
4. 名前を先に入力してからURLを貼り付けた場合は自動入力されないことを確認

- [ ] **Step 4: コミット**

```bash
git add apps/web/components/schedule-form-fields.tsx
git commit -m "feat: URL入力時にOGPタイトルを自動取得して名前欄に入力"
```

---

### Task 8: FAQ・お知らせ更新

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`
- Create: `apps/web/content/news/ja/2026-03-30-share-target.md`
- Create: `apps/web/content/news/en/2026-03-30-share-target.md`

- [ ] **Step 1: FAQを追加**

`apps/api/src/db/seed-faqs.ts` の `JA_FAQS` に追加:

```typescript
{
  question: "スマホのブラウザからURLを旅行に追加できますか？",
  answer: "はい。sugaraをPWAとしてインストールした状態で、ブラウザの共有メニューからsugaraを選択すると、候補として追加できます。",
  sortOrder: <既存の最大値+10>,
},
```

`EN_FAQS` に追加:

```typescript
{
  question: "Can I add a URL to a trip from my phone's browser?",
  answer: "Yes. With sugara installed as a PWA, select sugara from your browser's share menu to add it as a candidate.",
  sortOrder: <same as above>,
},
```

`sortOrder` は既存のFAQ一覧の末尾に合わせて設定すること。

- [ ] **Step 2: お知らせ記事を作成**

既存のお知らせ記事 (`apps/web/content/news/ja/` 内) のフォーマットを確認し、同じfrontmatter構造で作成する。

- [ ] **Step 3: FAQシードを実行**

Run: `bun run --filter @sugara/api db:seed-faqs`

- [ ] **Step 4: コミット**

```bash
git add apps/api/src/db/seed-faqs.ts apps/web/content/news/ja/2026-03-30-share-target.md apps/web/content/news/en/2026-03-30-share-target.md
git commit -m "docs: Share Target機能のFAQとお知らせを追加"
```
