# Admin Signup Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 管理ダッシュボードにサインアップON/OFFトグルを追加し、無効時はすべての新規登録経路でメッセージを表示する。

**Architecture:** `app_settings` テーブルにシングルロウでフラグを保持。APIルートレイヤーでサインアップを遮断。Server Components は `getAppSettings()` を直接呼び出し、Client Components は `/api/public/settings` をポーリング。

**Tech Stack:** Drizzle ORM, Hono, React Query (@tanstack/react-query), Next.js App Router, Radix UI Switch

---

### Task 1: DB スキーマ追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: appSettings テーブルを schema.ts に追加**

`apps/api/src/db/schema.ts` の既存テーブルの末尾（最後の export の前）に追加:

```ts
export const appSettings = pgTable(
  "app_settings",
  {
    id: smallint("id").primaryKey().default(1),
    signupEnabled: boolean("signup_enabled").notNull().default(true),
  },
  (table) => [check("app_settings_single_row", sql`${table.id} = 1`)],
);
```

`smallint` と `boolean` は既存の import リストに含まれているか確認し、なければ追加する。

**Step 2: マイグレーションファイルを生成**

```bash
bun run --filter @sugara/api db:generate
```

Expected: `drizzle/` 以下に新しい `.sql` ファイルが生成される。

**Step 3: 生成されたSQLにデフォルト行の INSERT を追加**

生成されたマイグレーションファイル（`drizzle/<timestamp>_*.sql`）の末尾に追記:

```sql
INSERT INTO "app_settings" ("id", "signup_enabled") VALUES (1, true);
```

**Step 4: ローカル DB に適用**

```bash
bun run --filter @sugara/api db:migrate
```

Expected: `All migrations applied` のようなメッセージ。

**Step 5: Commit**

```bash
git add apps/api/src/db/schema.ts drizzle/
git commit -m "feat: app_settings テーブルを追加（signup_enabled フラグ）"
```

---

### Task 2: getAppSettings ヘルパー + パッケージエクスポート

**Files:**
- Create: `apps/api/src/lib/app-settings.ts`
- Modify: `apps/api/package.json`

**Step 1: app-settings.ts を作成**

```ts
import { db } from "../db/index";
import { appSettings } from "../db/schema";

export type AppSettings = {
  signupEnabled: boolean;
};

// Reads the single settings row. Falls back to permissive defaults if the row
// is missing (e.g., before the INSERT migration runs in CI).
export async function getAppSettings(): Promise<AppSettings> {
  const row = await db
    .select({ signupEnabled: appSettings.signupEnabled })
    .from(appSettings)
    .limit(1);

  return row[0] ?? { signupEnabled: true };
}
```

**Step 2: package.json にエクスポートパスを追加**

`apps/api/package.json` の `"exports"` フィールドを更新:

```json
"exports": {
  ".": "./src/app.ts",
  "./lib/app-settings": "./src/lib/app-settings.ts"
}
```

---

### Task 3: Public settings ルート + 登録

**Files:**
- Create: `apps/api/src/routes/public-settings.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: テストを書く**

`apps/api/src/__tests__/public-settings.test.ts` を作成:

```ts
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAppSettings = vi.fn();

vi.mock("../lib/app-settings", () => ({
  getAppSettings: (...args: unknown[]) => mockGetAppSettings(...args),
}));

import { publicSettingsRoutes } from "../routes/public-settings";

function createApp() {
  const app = new Hono();
  app.route("/", publicSettingsRoutes);
  return app;
}

describe("GET /api/public/settings", () => {
  const app = createApp();

  beforeEach(() => {
    mockGetAppSettings.mockResolvedValue({ signupEnabled: true });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("returns signupEnabled: true when signup is open", async () => {
    const res = await app.request("/api/public/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: true });
  });

  it("returns signupEnabled: false when signup is disabled", async () => {
    mockGetAppSettings.mockResolvedValue({ signupEnabled: false });
    const res = await app.request("/api/public/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: false });
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test
```

Expected: FAIL - `Cannot find module '../routes/public-settings'`

**Step 3: ルートを実装**

`apps/api/src/routes/public-settings.ts` を作成:

```ts
import { Hono } from "hono";
import { getAppSettings } from "../lib/app-settings";

const publicSettingsRoutes = new Hono();

publicSettingsRoutes.get("/api/public/settings", async (c) => {
  const settings = await getAppSettings();
  return c.json({ signupEnabled: settings.signupEnabled });
});

export { publicSettingsRoutes };
```

**Step 4: app.ts に登録**

`apps/api/src/app.ts` に import と route 登録を追加:

```ts
import { publicSettingsRoutes } from "./routes/public-settings";
// ...
app.route("/", publicSettingsRoutes); // adminRoutes の前に追加
```

**Step 5: テストが通ることを確認**

```bash
bun run --filter @sugara/api test
```

Expected: PASS

---

### Task 4: Admin settings エンドポイント + 統合テスト

**Files:**
- Modify: `apps/api/src/routes/admin.ts`
- Modify: `apps/api/src/__tests__/integration/admin.integration.test.ts`

**Step 1: 統合テストを追加**

`admin.integration.test.ts` の既存テストの末尾に追加:

```ts
describe("GET /api/admin/settings", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/api/admin/settings");
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Other", email: "other@test.com", username: "notadmin", isAnonymous: false },
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings");
    expect(res.status).toBe(403);
  });

  it("returns current settings when admin", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-1", name: "Admin", email: "admin@test.com", username: "adminuser", isAnonymous: false },
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("signupEnabled");
    expect(typeof body.signupEnabled).toBe("boolean");
  });
});

describe("PATCH /api/admin/settings", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await app.request("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ signupEnabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-1", name: "Admin", email: "admin@test.com", username: "adminuser", isAnonymous: false },
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ signupEnabled: "yes" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
  });

  it("updates signupEnabled and returns new value", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "admin-1", name: "Admin", email: "admin@test.com", username: "adminuser", isAnonymous: false },
      session: { id: "session-1" },
    });
    const res = await app.request("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ signupEnabled: false }),
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ signupEnabled: false });

    // Verify persisted
    const getRes = await app.request("/api/admin/settings");
    const getBody = await getRes.json();
    expect(getBody.signupEnabled).toBe(false);
  });
});
```

**Step 2: 統合テストが失敗することを確認**

```bash
bun run --filter @sugara/api test:integration
```

Expected: FAIL - 404 for `/api/admin/settings`

**Step 3: admin.ts にエンドポイントを追加**

`apps/api/src/routes/admin.ts` の `adminRoutes.get("/api/admin/stats", ...)` の前に追加:

まず import を追加:
```ts
import { eq } from "drizzle-orm";
import { appSettings } from "../db/schema";
import { getAppSettings } from "../lib/app-settings";
```

（既存の import に `eq` が含まれていれば追加不要、`appSettings` と `getAppSettings` を追加）

エンドポイントを追加:

```ts
adminRoutes.get("/api/admin/settings", requireAuth, requireAdmin, async (c) => {
  const settings = await getAppSettings();
  return c.json({ signupEnabled: settings.signupEnabled });
});

adminRoutes.patch("/api/admin/settings", requireAuth, requireAdmin, async (c) => {
  const body = await c.req.json<{ signupEnabled: unknown }>();

  if (typeof body.signupEnabled !== "boolean") {
    return c.json({ error: "signupEnabled must be a boolean" }, 400);
  }

  await db
    .update(appSettings)
    .set({ signupEnabled: body.signupEnabled })
    .where(eq(appSettings.id, 1));

  return c.json({ signupEnabled: body.signupEnabled });
});
```

**Step 4: 統合テストが通ることを確認**

```bash
bun run --filter @sugara/api test:integration
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/lib/app-settings.ts apps/api/src/routes/public-settings.ts apps/api/src/routes/admin.ts apps/api/src/app.ts apps/api/package.json apps/api/src/__tests__/
git commit -m "feat(api): getAppSettings・public/admin settings エンドポイントを追加"
```

---

### Task 5: Auth サインアップインターセプター + テスト

**Files:**
- Modify: `apps/api/src/routes/auth.ts`
- Create: `apps/api/src/__tests__/auth-signup-intercept.test.ts`

**Step 1: テストを書く**

`apps/api/src/__tests__/auth-signup-intercept.test.ts` を作成:

```ts
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAppSettings = vi.fn();

vi.mock("../lib/app-settings", () => ({
  getAppSettings: (...args: unknown[]) => mockGetAppSettings(...args),
}));

// Mock Better Auth handler to avoid real auth processing
vi.mock("../lib/auth", () => ({
  auth: {
    handler: () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  },
}));

import { authRoutes } from "../routes/auth";

function createApp() {
  const app = new Hono();
  app.route("/", authRoutes);
  return app;
}

describe("POST /api/auth/sign-up/* (signup interceptor)", () => {
  const app = createApp();

  beforeEach(() => {
    mockGetAppSettings.mockResolvedValue({ signupEnabled: true });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("passes through when signup is enabled", async () => {
    const res = await app.request("/api/auth/sign-up/email", { method: "POST" });
    // Better Auth mock returns 200
    expect(res.status).toBe(200);
  });

  it("returns 403 when signup is disabled", async () => {
    mockGetAppSettings.mockResolvedValue({ signupEnabled: false });
    const res = await app.request("/api/auth/sign-up/email", { method: "POST" });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("新規利用の受付を停止しています");
  });

  it("does not block sign-in routes", async () => {
    mockGetAppSettings.mockResolvedValue({ signupEnabled: false });
    const res = await app.request("/api/auth/sign-in/anonymous", { method: "POST" });
    // Not intercepted, reaches Better Auth mock
    expect(res.status).toBe(200);
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test
```

Expected: FAIL - インターセプターが存在しないためスルーされる

**Step 3: auth.ts にインターセプターを追加**

`apps/api/src/routes/auth.ts` を更新:

```ts
import { Hono } from "hono";
import { getAppSettings } from "../lib/app-settings";
import { auth } from "../lib/auth";

const authRoutes = new Hono();

// Block email/password signup when the admin has disabled new registrations.
// Anonymous sign-in (/api/auth/sign-in/anonymous) is intentionally not blocked
// because guest accounts are ephemeral (7-day TTL) and accumulate minimal data.
authRoutes.post("/api/auth/sign-up/*", async (c, next) => {
  const { signupEnabled } = await getAppSettings();
  if (!signupEnabled) {
    return c.json({ error: "新規利用の受付を停止しています" }, 403);
  }
  return next();
});

authRoutes.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

export { authRoutes };
```

**Step 4: テストが通ることを確認**

```bash
bun run --filter @sugara/api test
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/__tests__/auth-signup-intercept.test.ts
git commit -m "feat(api): サインアップ無効時に403を返すインターセプターを追加"
```

---

### Task 6: フロントエンド基盤（messages.ts + query-keys）

**Files:**
- Modify: `apps/web/lib/messages.ts`
- Modify: `apps/web/lib/query-keys.ts`

**Step 1: messages.ts に SIGNUP_DISABLED を追加**

`apps/web/lib/messages.ts` の Auth セクション（`AUTH_GUEST_TRIP_LIMIT` の後）に追加:

```ts
AUTH_SIGNUP_DISABLED: "新規利用の受付を停止しています",
AUTH_SIGNUP_DISABLED_DETAIL: "現在、新規利用の受付を停止しています。再開までしばらくお待ちください。",
```

**Step 2: query-keys.ts に publicSettings と admin.settings を追加**

`apps/web/lib/query-keys.ts` の `admin` セクションを更新し、`publicSettings` を追加:

```ts
publicSettings: {
  all: ["publicSettings"] as const,
  detail: () => [...queryKeys.publicSettings.all] as const,
},
admin: {
  stats: () => ["admin", "stats"] as const,
  settings: () => ["admin", "settings"] as const,
},
```

---

### Task 7: ランディングページ（Server Component）

**Files:**
- Modify: `apps/web/app/page.tsx`

**Step 1: page.tsx を更新**

`apps/web/app/page.tsx` を async Server Component に変更し、設定を取得:

```tsx
import { getAppSettings } from "@sugara/api/lib/app-settings";
import { ArrowRight, LogIn } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const { signupEnabled } = await getAppSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight sm:text-5xl">
          計画もまた、旅の楽しみだ。
        </h1>
        <p className="mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
          旅行の計画を作成・共有できる共同編集アプリ。
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          {signupEnabled ? (
            <Button asChild size="lg">
              <Link href="/auth/signup">
                <ArrowRight className="h-4 w-4" />
                新規登録
              </Link>
            </Button>
          ) : (
            <Button
              size="lg"
              disabled
              title="現在、新規利用の受付を停止しています"
            >
              <ArrowRight className="h-4 w-4" />
              新規登録（受付停止中）
            </Button>
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/auth/login">
              <LogIn className="h-4 w-4" />
              ログイン
            </Link>
          </Button>
        </div>
      </main>

      <footer className="container flex flex-wrap items-center justify-center gap-x-4 gap-y-1 py-4 text-sm text-muted-foreground">
        <Link href="/faq" className="underline underline-offset-4 hover:text-foreground">
          よくある質問
        </Link>
        <Link href="/news" className="underline underline-offset-4 hover:text-foreground">
          お知らせ
        </Link>
        <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
          利用規約
        </Link>
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}
```

---

### Task 8: サインアップページ（Server Component）

**Files:**
- Modify: `apps/web/app/auth/signup/page.tsx`

**Step 1: page.tsx を更新**

```tsx
import { getAppSettings } from "@sugara/api/lib/app-settings";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SignupForm } from "@/components/signup-form";

export default async function SignupPage() {
  const { signupEnabled } = await getAppSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="container flex h-14 items-center">
        <Logo href="/" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-0 sm:px-4">
        {signupEnabled ? (
          <SignupForm />
        ) : (
          <div className="w-full max-w-sm space-y-3 px-4 text-center">
            <p className="font-medium">現在、新規利用の受付を停止しています。</p>
            <p className="text-sm text-muted-foreground">
              再開までしばらくお待ちください。
            </p>
            <p className="text-sm">
              <Link href="/auth/login" className="underline underline-offset-4 hover:text-foreground">
                ログインはこちら
              </Link>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
```

---

### Task 9: SignupForm フォールバック（クライアント側 403 ハンドリング）

**Files:**
- Modify: `apps/web/components/signup-form.tsx`

**Step 1: signup-form.tsx のエラーハンドリングを更新**

`signup-form.tsx` 内の `signUp.email()` 呼び出し後のエラーハンドリング部分を探す（`result.error` のチェック箇所）。以下のように 403 を先に処理するよう変更:

```ts
if (result.error) {
  // Our signup interceptor returns 403 when registration is disabled.
  // Better Auth surfaces this as error.status.
  if (result.error.status === 403) {
    setError(MSG.AUTH_SIGNUP_DISABLED);
  } else {
    setError(translateAuthError(result.error, MSG.AUTH_SIGNUP_FAILED));
  }
  return;
}
```

同様に `guest-upgrade-dialog.tsx` の `signUp.email()` エラーハンドリングにも同じ変更を適用する:

```ts
if (result.error) {
  if (result.error.status === 403) {
    setError(MSG.AUTH_SIGNUP_DISABLED);
  } else {
    setError(translateAuthError(result.error, MSG.AUTH_GUEST_UPGRADE_FAILED));
  }
  return;
}
```

---

### Task 10: GuestBanner（サインアップ無効時に登録ボタンを非表示）

**Files:**
- Modify: `apps/web/components/guest-banner.tsx`

**Step 1: guest-banner.tsx を更新**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GuestUpgradeDialog } from "@/components/guest-upgrade-dialog";
import { useSession } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { getGuestDaysRemaining, isGuestUser } from "@/lib/guest";
import { queryKeys } from "@/lib/query-keys";

export function GuestBanner() {
  const { data: session } = useSession();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data: publicSettings } = useQuery({
    queryKey: queryKeys.publicSettings.detail(),
    queryFn: () => api<{ signupEnabled: boolean }>("/api/public/settings"),
    staleTime: 5 * 60 * 1000,
  });

  if (!isGuestUser(session)) return null;

  const daysRemaining = getGuestDaysRemaining(session);
  const signupEnabled = publicSettings?.signupEnabled ?? true;

  return (
    <>
      <div className="border-b bg-amber-50 dark:bg-amber-950/30">
        <div className="container flex items-center justify-between px-4 py-1.5 text-sm">
          <span className="text-amber-900 dark:text-amber-200">
            ゲストモード（残り{daysRemaining}日）
          </span>
          {signupEnabled && (
            <button
              type="button"
              className="rounded-full bg-amber-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
              onClick={() => setUpgradeOpen(true)}
            >
              アカウント登録
            </button>
          )}
        </div>
      </div>
      <GuestUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/lib/messages.ts apps/web/lib/query-keys.ts apps/web/app/page.tsx apps/web/app/auth/signup/page.tsx apps/web/components/signup-form.tsx apps/web/components/guest-upgrade-dialog.tsx apps/web/components/guest-banner.tsx
git commit -m "feat(web): サインアップ無効時のUI対応（ランディング・サインアップページ・ゲストバナー）"
```

---

### Task 11: 管理ダッシュボード設定セクション

**Files:**
- Create: `apps/web/components/ui/switch.tsx`
- Modify: `apps/web/app/admin/page.tsx`

**Step 1: Switch コンポーネントを作成**

`@radix-ui/react-switch` をインストール:

```bash
bun add --filter @sugara/web @radix-ui/react-switch
```

`apps/web/components/ui/switch.tsx` を作成:

```tsx
"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
```

**Step 2: admin/page.tsx に設定セクションを追加**

`apps/web/app/admin/page.tsx` を更新。以下の変更を加える:

1. 既存の import に追加:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { MSG } from "@/lib/messages";
```

（`useQuery` と `useQueryClient` が既にインポートされていれば `useMutation` だけ追加）

2. `AdminPage` 内に設定クエリとミューテーションを追加:

```ts
const queryClient = useQueryClient();

const { data: settings } = useQuery({
  queryKey: queryKeys.admin.settings(),
  queryFn: () => api<{ signupEnabled: boolean }>("/api/admin/settings"),
  staleTime: 60 * 1000,
  retry: (failureCount, err) => {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) return false;
    return failureCount < 3;
  },
});

const { mutate: updateSettings, isPending: isUpdatingSettings } = useMutation({
  mutationFn: (signupEnabled: boolean) =>
    api<{ signupEnabled: boolean }>("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ signupEnabled }),
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.settings() });
  },
  onError: () => {
    toast.error("設定の更新に失敗しました");
  },
});
```

3. `{data && (...)}` ブロックの末尾（`</>`の前）に「設定」セクションを追加:

```tsx
<Section title="設定">
  <div className="rounded-lg border bg-card p-5">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-medium text-sm">新規利用受付</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {settings?.signupEnabled
            ? "現在、新規アカウントの登録を受け付けています"
            : "現在、新規利用の受付を停止しています"}
        </p>
      </div>
      <Switch
        checked={settings?.signupEnabled ?? true}
        onCheckedChange={(checked) => updateSettings(checked)}
        disabled={isUpdatingSettings || settings === undefined}
        aria-label="新規利用受付の切り替え"
      />
    </div>
  </div>
</Section>
```

**Step 3: 型チェック + lint**

```bash
bun run check-types
bun run check
```

Expected: エラーなし

**Step 4: Commit**

```bash
git add apps/web/components/ui/switch.tsx apps/web/app/admin/page.tsx apps/web/package.json bun.lock
git commit -m "feat(web): 管理ダッシュボードにサインアップ受付トグルを追加"
```

---

### Task 12: 動作確認

**Step 1: ローカルで起動**

```bash
bun run --filter @sugara/web dev
```

**Step 2: 確認手順**

1. 管理ダッシュボード（`/admin`）にアクセスし「設定」セクションが表示される
2. スイッチをOFFにする → ランディングページ（`/`）で「新規登録（受付停止中）」ボタンが disabled になる
3. `/auth/signup` にアクセス → フォームの代わりに「受付停止」メッセージが表示される
4. スイッチをONに戻す → 各ページが通常表示に戻る

**Step 3: テスト全体実行**

```bash
bun run test
```

Expected: PASS

---

### 本番適用

```bash
MIGRATION_URL=<本番TransactionPooler URL> bun run --filter @sugara/api db:migrate
```

その後 Vercel へのデプロイで自動反映される。
