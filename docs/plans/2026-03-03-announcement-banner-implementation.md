# Announcement Banner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the admin to set a site-wide announcement banner from the admin dashboard, backed by Vercel Edge Config (no DB dependency, no redeploy needed).

**Architecture:** A new Hono route `GET /api/announcement` reads from Edge Config and returns `{ message: string | null }`. A second route `POST /api/admin/announcement` (admin-only) calls the Vercel REST API to update Edge Config. `AnnouncementBanner` is a Client Component that fetches once on mount and renders a yellow banner. It is placed inside both `header.tsx` and `sp-header.tsx`.

**Tech Stack:** `@vercel/edge-config`, Vercel REST API, Hono, React Client Component

---

### Task 1: Add `@vercel/edge-config` package

**Files:**
- Modify: `apps/api/package.json`

**Step 1: Add the package**

```bash
bun add --filter @sugara/api @vercel/edge-config
```

Expected: `@vercel/edge-config` appears in `apps/api/package.json` dependencies.

**Step 2: Commit**

```bash
git add apps/api/package.json bun.lock
git commit -m "chore: @vercel/edge-config を追加"
```

---

### Task 2: `GET /api/announcement` route

**Files:**
- Create: `apps/api/src/routes/announcement.ts`
- Create: `apps/api/src/__tests__/announcement.test.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: Write the failing test**

Create `apps/api/src/__tests__/announcement.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp } from "./test-helpers";

const mockGet = vi.fn();

vi.mock("@vercel/edge-config", () => ({
  get: (...args: unknown[]) => mockGet(...args),
}));

import { announcementRoutes } from "../routes/announcement";

function createApp() {
  return createTestApp(announcementRoutes, "/");
}

describe("GET /api/announcement", () => {
  const app = createApp();

  beforeEach(() => {
    delete process.env.EDGE_CONFIG;
    mockGet.mockReset();
  });

  it("returns message: null when EDGE_CONFIG is not set", async () => {
    const res = await app.request("/api/announcement");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: null });
  });

  it("returns message when set in Edge Config", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_x?token=x";
    mockGet.mockResolvedValue("メンテナンス中です");
    const res = await app.request("/api/announcement");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "メンテナンス中です" });
  });

  it("returns message: null when Edge Config key is empty string", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_x?token=x";
    mockGet.mockResolvedValue("");
    const res = await app.request("/api/announcement");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: null });
  });

  it("returns message: null when Edge Config key is undefined", async () => {
    process.env.EDGE_CONFIG = "https://edge-config.vercel.com/ecfg_x?token=x";
    mockGet.mockResolvedValue(undefined);
    const res = await app.request("/api/announcement");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: null });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/api test
```

Expected: FAIL — `announcementRoutes` not found.

**Step 3: Create the route**

Create `apps/api/src/routes/announcement.ts`:

```ts
import { get } from "@vercel/edge-config";
import { Hono } from "hono";
import type { AppEnv } from "../types";

const announcementRoutes = new Hono<AppEnv>();

announcementRoutes.get("/api/announcement", async (c) => {
  if (!process.env.EDGE_CONFIG) {
    return c.json({ message: null });
  }
  try {
    const value = await get<string>("announcement");
    return c.json({ message: value || null });
  } catch {
    return c.json({ message: null });
  }
});

export { announcementRoutes };
```

**Step 4: Register in `apps/api/src/app.ts`**

Add import at the top (after existing imports):
```ts
import { announcementRoutes } from "./routes/announcement";
```

Add route before `export { app }`:
```ts
app.route("/", announcementRoutes);
```

**Step 5: Run tests to verify they pass**

```bash
bun run --filter @sugara/api test
```

Expected: All announcement tests PASS.

**Step 6: Commit**

```bash
git add apps/api/src/routes/announcement.ts apps/api/src/__tests__/announcement.test.ts apps/api/src/app.ts
git commit -m "feat: GET /api/announcement エンドポイントを追加"
```

---

### Task 3: `POST /api/admin/announcement` route

**Files:**
- Modify: `apps/api/src/routes/admin.ts`
- Create: `apps/api/src/__tests__/admin-announcement.test.ts`

**Step 1: Write the failing test**

Create `apps/api/src/__tests__/admin-announcement.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestApp, TEST_USER } from "./test-helpers";

const mockGetSession = vi.fn();
const mockFetch = vi.fn();
const mockGet = vi.fn();

vi.mock("../lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("../db/index", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));

vi.mock("@vercel/edge-config", () => ({
  get: (...args: unknown[]) => mockGet(...args),
}));

vi.stubGlobal("fetch", mockFetch);

import { adminRoutes } from "../routes/admin";

const ADMIN_USER = {
  ...TEST_USER,
  username: "adminuser",
  isAnonymous: false,
  guestExpiresAt: null,
};

function createApp() {
  return createTestApp(adminRoutes, "/");
}

describe("POST /api/admin/announcement", () => {
  const app = createApp();

  beforeEach(() => {
    process.env.ADMIN_USERNAME = "adminuser";
    delete process.env.VERCEL_API_TOKEN;
    delete process.env.EDGE_CONFIG_ID;
    mockGet.mockReset();
    mockFetch.mockReset();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/api/admin/announcement", {
      method: "POST",
      body: JSON.stringify({ message: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockGetSession.mockResolvedValue({
      user: { ...ADMIN_USER, username: "notadmin" },
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/announcement", {
      method: "POST",
      body: JSON.stringify({ message: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(403);
  });

  it("returns 503 when env vars are missing", async () => {
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/announcement", {
      method: "POST",
      body: JSON.stringify({ message: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(503);
  });

  it("returns 400 when message is not a string", async () => {
    process.env.VERCEL_API_TOKEN = "token";
    process.env.EDGE_CONFIG_ID = "ecfg_xxx";
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/announcement", {
      method: "POST",
      body: JSON.stringify({ message: 42 }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("updates Edge Config and returns message", async () => {
    process.env.VERCEL_API_TOKEN = "token";
    process.env.EDGE_CONFIG_ID = "ecfg_xxx";
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    mockFetch.mockResolvedValue({ ok: true });
    const res = await app.request("/api/admin/announcement", {
      method: "POST",
      body: JSON.stringify({ message: "障害が発生しています" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "障害が発生しています" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.vercel.com/v1/edge-config/ecfg_xxx/items",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("clears announcement when message is empty string", async () => {
    process.env.VERCEL_API_TOKEN = "token";
    process.env.EDGE_CONFIG_ID = "ecfg_xxx";
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    mockFetch.mockResolvedValue({ ok: true });
    const res = await app.request("/api/admin/announcement", {
      method: "POST",
      body: JSON.stringify({ message: "" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: null });
  });

  it("returns 502 when Vercel API fails", async () => {
    process.env.VERCEL_API_TOKEN = "token";
    process.env.EDGE_CONFIG_ID = "ecfg_xxx";
    mockGetSession.mockResolvedValue({
      user: ADMIN_USER,
      session: { id: "session-1" },
    });
    mockFetch.mockResolvedValue({ ok: false });
    const res = await app.request("/api/admin/announcement", {
      method: "POST",
      body: JSON.stringify({ message: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(502);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/api test
```

Expected: FAIL — route not found.

**Step 3: Add route to `apps/api/src/routes/admin.ts`**

Append before the final `export` line (after the existing routes):

```ts
adminRoutes.post("/api/admin/announcement", requireAuth, requireAdmin, async (c) => {
  const apiToken = process.env.VERCEL_API_TOKEN;
  const configId = process.env.EDGE_CONFIG_ID;
  if (!apiToken || !configId) {
    return c.json({ error: "Edge Config not configured" }, 503);
  }

  const body = await c.req.json<{ message: unknown }>();
  if (typeof body.message !== "string") {
    return c.json({ error: "message must be a string" }, 400);
  }

  const res = await fetch(`https://api.vercel.com/v1/edge-config/${configId}/items`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: [{ operation: "upsert", key: "announcement", value: body.message }],
    }),
  });

  if (!res.ok) {
    return c.json({ error: "Failed to update Edge Config" }, 502);
  }

  return c.json({ message: body.message || null });
});
```

**Step 4: Run tests to verify they pass**

```bash
bun run --filter @sugara/api test
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/src/__tests__/admin-announcement.test.ts
git commit -m "feat: POST /api/admin/announcement エンドポイントを追加"
```

---

### Task 4: `AnnouncementBanner` component

**Files:**
- Create: `apps/web/components/announcement-banner.tsx`

No dedicated test needed — the component only fetches once and renders. Behavior
is covered by the API tests. A unit test would be testing React internals.

**Step 1: Create the component**

Create `apps/web/components/announcement-banner.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export function AnnouncementBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/announcement")
      .then((r) => r.json() as Promise<{ message: string | null }>)
      .then((data) => {
        setMessage(data.message || null);
      })
      .catch(() => {
        // Non-critical — silently ignore fetch errors
      });
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-yellow-950 dark:bg-yellow-600 dark:text-yellow-100"
    >
      {message}
    </div>
  );
}
```

**Step 2: Run type check**

```bash
bun run check-types
```

Expected: No errors.

**Step 3: Commit**

```bash
git add apps/web/components/announcement-banner.tsx
git commit -m "feat: AnnouncementBanner コンポーネントを追加"
```

---

### Task 5: Integrate banner into headers

**Files:**
- Modify: `apps/web/components/header.tsx`
- Modify: `apps/web/components/sp-header.tsx`

**Step 1: Add to `header.tsx`**

Add import after the existing banner imports:

```ts
import { AnnouncementBanner } from "@/components/announcement-banner";
```

In the JSX, add `<AnnouncementBanner />` above `<OfflineBanner />` (both are inside the sticky `<header>`):

```tsx
<header className="sticky top-0 z-30 select-none border-b bg-background">
  <AnnouncementBanner />   {/* ← add this line */}
  <OfflineBanner />
  <GuestBanner />
  ...
```

**Step 2: Add to `sp-header.tsx`**

Same import and same placement above `<OfflineBanner />`:

```tsx
<header className="sticky top-0 z-30 select-none border-b bg-background">
  <AnnouncementBanner />   {/* ← add this line */}
  <OfflineBanner />
  <GuestBanner />
  ...
```

**Step 3: Run type check and lint**

```bash
bun run check-types && bun run --filter @sugara/web lint
```

Expected: No errors.

**Step 4: Commit**

```bash
git add apps/web/components/header.tsx apps/web/components/sp-header.tsx
git commit -m "feat: ヘッダーに AnnouncementBanner を組み込む"
```

---

### Task 6: Admin dashboard UI

**Files:**
- Modify: `apps/web/lib/query-keys.ts`
- Modify: `apps/web/app/admin/page.tsx`

**Step 1: Add query key**

In `apps/web/lib/query-keys.ts`, add to the `admin` section:

```ts
admin: {
  stats: () => ["admin", "stats"] as const,
  settings: () => ["admin", "settings"] as const,
  users: () => ["admin", "users"] as const,
  announcement: () => ["admin", "announcement"] as const,  // ← add
},
```

**Step 2: Add `AnnouncementSection` function to `apps/web/app/admin/page.tsx`**

Add after the last helper function (e.g., after `UsageBar`), before `export default function AdminPage()`:

```tsx
function AnnouncementSection() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data } = useQuery({
    queryKey: queryKeys.admin.announcement(),
    queryFn: () => api<{ message: string | null }>("/api/announcement"),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (data !== undefined) {
      setDraft(data.message ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (message: string) =>
      api<{ message: string | null }>("/api/admin/announcement", {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.admin.announcement(), updated);
      toast.success(updated.message ? "アナウンスを設定しました" : "アナウンスをクリアしました");
    },
    onError: () => toast.error("アナウンスの更新に失敗しました"),
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div>
        <p className="font-medium text-sm">アナウンス</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          全ユーザーに表示されるバナーメッセージです。空にすると非表示になります。
        </p>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={200}
        rows={3}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="例: メンテナンス中のため一部機能が利用できません"
      />
      <p className="text-right text-xs text-muted-foreground">{draft.length}/200</p>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={save.isPending || !draft}
          onClick={() => save.mutate("")}
        >
          クリア
        </Button>
        <Button
          size="sm"
          disabled={save.isPending}
          onClick={() => save.mutate(draft)}
        >
          {save.isPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
```

**Step 3: Add `useEffect` to the imports in `admin/page.tsx`**

`useEffect` is used by `AnnouncementSection`. Check the existing import:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ..., useEffect, useState } from "react";  // add useEffect if not present
```

**Step 4: Place `AnnouncementSection` inside the settings tab**

In the `<TabsContent value="settings">` block, add after the existing signup toggle card:

```tsx
<TabsContent value="settings" className="space-y-4">
  {settings !== undefined && (
    <div className="rounded-lg border bg-card p-4">
      ...existing signup toggle...
    </div>
  )}
  <AnnouncementSection />   {/* ← add */}
</TabsContent>
```

Note: also add `className="space-y-4"` to the `TabsContent` if it doesn't already exist.

**Step 5: Run type check and lint**

```bash
bun run check-types && bun run --filter @sugara/web lint
```

Expected: No errors.

**Step 6: Commit**

```bash
git add apps/web/lib/query-keys.ts apps/web/app/admin/page.tsx
git commit -m "feat: 管理ダッシュボードにアナウンス管理UIを追加"
```

---

### Task 7: Vercel setup (manual, one-time)

These steps must be done manually in the Vercel dashboard before the feature is live.

1. Go to **Vercel dashboard → Storage → Create Edge Config store** (e.g. `sugara-config`).
2. **Link to project**: project settings → Integrations → Edge Config → Connect. Vercel auto-sets `EDGE_CONFIG` env var.
3. **Add initial key**: in the Edge Config editor, add key `announcement` with value `""`.
4. **Create API token**: Account Settings → Tokens → Create token (full access, no expiry).
5. **Add env vars** to the Vercel project:
   - `VERCEL_API_TOKEN` = the token from step 4
   - `EDGE_CONFIG_ID` = the Edge Config store ID (from the store URL, e.g. `ecfg_xxxxxxxx`)
6. **Redeploy** the project once so all env vars take effect.

After this, setting a message via the admin dashboard will appear as a banner on all pages within seconds.

---

### Task 8: Push

```bash
git push origin main
```
