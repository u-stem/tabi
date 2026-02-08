# PWA + Offline Viewing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable offline viewing of trip itineraries and map tiles via Service Worker, with PWA installability.

**Architecture:** Serwist (next-pwa successor) generates and manages the Service Worker at build time. Runtime caching rules handle API responses (NetworkFirst) and map tiles (CacheFirst). A `useOnlineStatus` hook drives the offline banner and disables edit actions.

**Tech Stack:** @serwist/next, serwist, Next.js 15 Metadata API (manifest.ts)

---

### Task 1: Install Serwist and configure Next.js

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`

**Step 1: Install dependencies**

Run: `bun add @serwist/next --cwd /Users/mikiya/ws/tabi/apps/web`
Run: `bun add -D serwist --cwd /Users/mikiya/ws/tabi/apps/web`

**Step 2: Update next.config.ts**

```typescript
import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  transpilePackages: ["@tabi/shared"],
};

export default withSerwist(nextConfig);
```

**Step 3: Add public/sw.js to .gitignore**

Append to `apps/web/.gitignore` (create if needed):
```
/public/sw.js
/public/swe-worker-*.js
```

**Step 4: Verify build succeeds**

Run: `bun run --filter @tabi/web build`
Expected: Build completes (sw.ts doesn't exist yet, but Serwist should handle gracefully or we create a minimal one first)

**Step 5: Commit**

```
git add apps/web/package.json apps/web/next.config.ts apps/web/.gitignore
git commit -m "chore: Serwistを導入しNext.js設定を更新"
```

---

### Task 2: Create Service Worker with runtime caching

**Files:**
- Create: `apps/web/app/sw.ts`

**Step 1: Create the Service Worker file**

```typescript
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkFirst, Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

const apiCache: RuntimeCaching = {
  urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
  handler: new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
};

const mapTileCache: RuntimeCaching = {
  urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/,
  handler: new CacheFirst({
    cacheName: "map-tiles",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        maxAgeFrom: "last-used",
      }),
    ],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [apiCache, mapTileCache, ...defaultCache],
});

serwist.addEventListeners();
```

**Step 2: Verify build succeeds**

Run: `bun run --filter @tabi/web build`
Expected: Build completes and `apps/web/public/sw.js` is generated

**Step 3: Commit**

```
git add apps/web/app/sw.ts
git commit -m "feat: Service Workerを追加 (API・地図タイルのキャッシュ)"
```

---

### Task 3: Create PWA manifest and icons

**Files:**
- Create: `apps/web/app/manifest.ts`
- Create: `apps/web/public/icons/icon-192.png`
- Create: `apps/web/public/icons/icon-512.png`

**Step 1: Create manifest.ts**

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tabi - 旅行プランナー",
    short_name: "tabi",
    description: "あなたの旅を、もっと自由に",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#09090b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
```

**Step 2: Generate PWA icons**

Create minimal placeholder icons using ImageMagick or similar:
```bash
mkdir -p apps/web/public/icons
# Generate simple icons with "t" text on zinc background
convert -size 192x192 xc:#09090b -fill white -font Helvetica-Bold \
  -pointsize 120 -gravity center -annotate 0 "t" apps/web/public/icons/icon-192.png
convert -size 512x512 xc:#09090b -fill white -font Helvetica-Bold \
  -pointsize 320 -gravity center -annotate 0 "t" apps/web/public/icons/icon-512.png
```

If ImageMagick is not available, create icons manually or use any PNG image of the correct size.

**Step 3: Verify manifest is served**

Run: `bun run --filter @tabi/web build && bun run --filter @tabi/web start`
Visit: `http://localhost:3000/manifest.webmanifest`
Expected: JSON manifest with correct fields

**Step 4: Commit**

```
git add apps/web/app/manifest.ts apps/web/public/icons/
git commit -m "feat: PWAマニフェストとアイコンを追加"
```

---

### Task 4: Create useOnlineStatus hook with test

**Files:**
- Create: `apps/web/lib/hooks/use-online-status.ts`
- Test: `apps/web/lib/__tests__/use-online-status.test.ts`

**Step 1: Write the failing test**

```typescript
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "../hooks/use-online-status";

describe("useOnlineStatus", () => {
  const listeners: Record<string, EventListener> = {};

  beforeEach(() => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.spyOn(window, "addEventListener").mockImplementation(
      (event: string, handler: EventListener) => {
        listeners[event] = handler;
      },
    );
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when online", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("returns false when offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it("updates when going offline", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      vi.stubGlobal("navigator", { onLine: false });
      listeners.offline(new Event("offline"));
    });
    expect(result.current).toBe(false);
  });

  it("updates when going online", () => {
    vi.stubGlobal("navigator", { onLine: false });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);

    act(() => {
      vi.stubGlobal("navigator", { onLine: true });
      listeners.online(new Event("online"));
    });
    expect(result.current).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run --filter @tabi/web test`
Expected: FAIL - module not found

**Step 3: Install @testing-library/react (needed for renderHook)**

Run: `bun add -D @testing-library/react @testing-library/dom --cwd /Users/mikiya/ws/tabi/apps/web`

**Step 4: Write minimal implementation**

```typescript
import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
```

**Step 5: Run test to verify it passes**

Run: `bun run --filter @tabi/web test`
Expected: All tests PASS

**Step 6: Commit**

```
git add apps/web/lib/hooks/use-online-status.ts apps/web/lib/__tests__/use-online-status.test.ts apps/web/package.json
git commit -m "feat: useOnlineStatusフックを追加"
```

---

### Task 5: Create OfflineBanner component

**Files:**
- Create: `apps/web/components/offline-banner.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useOnlineStatus } from "@/lib/hooks/use-online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      className="bg-yellow-100 text-yellow-900 text-center text-sm py-1.5 px-4 border-b border-yellow-200"
    >
      オフラインです。最後に閲覧したデータを表示しています。
    </div>
  );
}
```

**Step 2: Add OfflineBanner to Header**

Modify `apps/web/components/header.tsx`:
- Import `OfflineBanner`
- Render `<OfflineBanner />` before or after the `<header>` tag

```typescript
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OfflineBanner } from "@/components/offline-banner";
import { signOut, useSession } from "@/lib/auth-client";

export function Header() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
    } catch {
      toast.error("ログアウトに失敗しました");
    }
  }

  return (
    <>
      <OfflineBanner />
      <header className="border-b">
        <nav aria-label="メインナビゲーション" className="container flex h-14 items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold">
            tabi
          </Link>
          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <span className="text-sm text-muted-foreground">
                  {session.user.name}
                </span>
                <Button variant="ghost" size="sm" onClick={handleSignOut}>
                  ログアウト
                </Button>
              </>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}
```

**Step 3: Verify lint and types pass**

Run: `bun run --filter @tabi/web lint`
Run: `bun run --filter @tabi/web check-types`

**Step 4: Commit**

```
git add apps/web/components/offline-banner.tsx apps/web/components/header.tsx
git commit -m "feat: オフラインバナーをヘッダーに追加"
```

---

### Task 6: Disable edit actions when offline

**Files:**
- Modify: `apps/web/components/trip-actions.tsx`
- Modify: `apps/web/components/day-timeline.tsx`
- Modify: `apps/web/components/add-spot-dialog.tsx`

**Step 1: Add useOnlineStatus to trip-actions.tsx**

Import `useOnlineStatus` and use it to disable status change, share, delete, and member buttons when offline.

```typescript
const online = useOnlineStatus();

// Disable Select, Buttons when !online
// Add title="オフラインです" to disabled elements
```

**Step 2: Add useOnlineStatus to day-timeline.tsx**

Disable "Add spot" button and drag-and-drop when offline.

**Step 3: Add useOnlineStatus to add-spot-dialog.tsx**

Disable the dialog trigger button when offline.

**Step 4: Verify lint and types pass**

Run: `bun run --filter @tabi/web lint`
Run: `bun run --filter @tabi/web check-types`

**Step 5: Verify all tests pass**

Run: `bun run --filter @tabi/web test`

**Step 6: Commit**

```
git add apps/web/components/trip-actions.tsx apps/web/components/day-timeline.tsx apps/web/components/add-spot-dialog.tsx
git commit -m "feat: オフライン時に編集操作を無効化"
```

---

### Task 7: Final verification

**Step 1: Run all tests**

Run: `bun run test`
Run: `bun run --filter @tabi/api test:integration`

**Step 2: Run lint and type checks**

Run: `bun run lint`
Run: `bun run check-types`

**Step 3: Build and verify PWA**

Run: `bun run --filter @tabi/web build`
Verify: `apps/web/public/sw.js` exists
Verify: `http://localhost:3000/manifest.webmanifest` returns correct JSON

**Step 4: Manual PWA verification (Chrome DevTools)**

1. Open Application > Service Workers: SW is registered
2. Open Application > Manifest: manifest is loaded with icons
3. Go offline (Network tab > Offline): dashboard and trip pages load from cache
4. Map tiles for previously viewed areas still visible
5. Edit buttons are disabled with offline banner visible

**Step 5: Commit any final fixes and update docs**

```
git commit -m "docs: PWA対応の情報をCLAUDE.mdに追加"
```
