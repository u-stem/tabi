# QRコードでフレンド申請 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** マイページにQRコードを表示し、スキャン後にフレンド申請確認ページへ誘導する。

**Architecture:** `react-qr-code` でクライアントサイドQR生成。`GET /api/users/:userId/profile` を既存の `profile.ts` に追加。スキャン後は `/friends/add?userId=xxx` の確認ページを経由して既存の `POST /api/friends/requests` を呼ぶ。

**Tech Stack:** react-qr-code, Next.js App Router (Client Components), Hono, Drizzle ORM, Vitest

---

### Task 1: 共有パッケージに UserProfileResponse 型を追加

**Files:**
- Create: `packages/shared/src/schemas/user.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/types.ts`

**Step 1: スキーマファイルを作成**

`packages/shared/src/schemas/user.ts` を新規作成:

```typescript
import { z } from "zod";

export const userProfileResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  image: z.string().nullable().optional(),
});
```

**Step 2: schemas/index.ts にエクスポートを追加**

`packages/shared/src/schemas/index.ts` の既存エクスポート末尾に追記:

```typescript
export * from "./user";
```

**Step 3: types.ts に型を追加**

`packages/shared/src/types.ts` の末尾に追記:

```typescript
export type UserProfileResponse = {
  id: string;
  name: string;
  image?: string | null;
};
```

**Step 4: 型チェックを実行**

```bash
bun run check-types
```

Expected: エラーなし

**Step 5: コミット**

```bash
git add packages/shared/src/schemas/user.ts packages/shared/src/schemas/index.ts packages/shared/src/types.ts
git commit -m "feat: UserProfileResponse 型定義を追加"
```

---

### Task 2: GET /api/users/:userId/profile エンドポイントを追加

**Files:**
- Modify: `apps/api/src/routes/profile.ts`
- Create: `apps/api/src/__tests__/profile.test.ts`（既存のファイルがあれば追記）

**Step 1: テストを書く**

`apps/api/src/__tests__/profile.test.ts` を確認して、既存のテストがある場合はそのファイルに追記、ない場合は新規作成。
（既存テストのパターン: `vi.hoisted()` でモック関数を定義してから `vi.mock()` でモジュールをモック化）

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSession, mockDbQuery } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockDbQuery: vi.fn(),
}));

vi.mock("../middleware/optional-auth", () => ({
  optionalAuth: vi.fn(async (c, next) => {
    c.set("user", mockGetSession());
    await next();
  }),
}));

vi.mock("../db/index", () => ({
  db: {
    query: {
      users: {
        findFirst: mockDbQuery,
      },
    },
  },
}));

import { app } from "../app";

const BASE = "/api/users";

const fakeUserId = "00000000-0000-0000-0000-000000000001";
const fakeViewerId = "00000000-0000-0000-0000-000000000002";
const fakeUser = { id: fakeUserId, name: "Alice", image: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockReturnValue({ id: fakeViewerId });
});

describe("GET /api/users/:userId/profile", () => {
  it("認証済みユーザーがプロフィールを取得できる", async () => {
    mockDbQuery.mockResolvedValueOnce(fakeUser);

    const res = await app.request(`${BASE}/${fakeUserId}/profile`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ id: fakeUserId, name: "Alice", image: null });
  });

  it("未認証の場合 401 を返す", async () => {
    mockGetSession.mockReturnValue(null);

    const res = await app.request(`${BASE}/${fakeUserId}/profile`);

    expect(res.status).toBe(401);
  });

  it("存在しないユーザーの場合 404 を返す", async () => {
    mockDbQuery.mockResolvedValueOnce(null);

    const res = await app.request(`${BASE}/${fakeUserId}/profile`);

    expect(res.status).toBe(404);
  });

  it("レスポンスにメールアドレスが含まれない", async () => {
    mockDbQuery.mockResolvedValueOnce(fakeUser);

    const res = await app.request(`${BASE}/${fakeUserId}/profile`);
    const body = await res.json();

    expect(body).not.toHaveProperty("email");
  });
});
```

**Step 2: テストが失敗することを確認**

```bash
bun run --filter @sugara/api test -- --reporter=verbose profile
```

Expected: FAIL（エンドポイントが存在しないため）

**Step 3: profile.ts にエンドポイントを追加**

`apps/api/src/routes/profile.ts` の既存エンドポイントの後（`export { profileRoutes }` の前）に追記:

```typescript
// Minimal public profile for friend request confirmation
profileRoutes.get("/:userId/profile", optionalAuth, async (c) => {
  const viewer = c.get("user");
  if (!viewer) return c.json({ error: "Unauthorized" }, 401);

  const userId = c.req.param("userId");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, image: true },
  });

  if (!user) return c.json({ error: ERROR_MSG.USER_NOT_FOUND }, 404);

  return c.json({ id: user.id, name: user.name, image: user.image });
});
```

**Step 4: テストが通ることを確認**

```bash
bun run --filter @sugara/api test -- --reporter=verbose profile
```

Expected: PASS (4 tests)

**Step 5: 型チェックと lint**

```bash
bun run check-types && bun run check
```

Expected: エラーなし

**Step 6: コミット**

```bash
git add apps/api/src/routes/profile.ts apps/api/src/__tests__/profile.test.ts
git commit -m "feat: GET /api/users/:userId/profile エンドポイントを追加"
```

---

### Task 3: react-qr-code をインストールして MyQrDialog コンポーネントを作成

**Files:**
- Install: `react-qr-code` in `@sugara/web`
- Create: `apps/web/components/my-qr-dialog.tsx`

**Step 1: パッケージをインストール**

```bash
bun add react-qr-code --filter @sugara/web
```

Expected: `apps/web/package.json` に `react-qr-code` が追加される

**Step 2: 型チェックして react-qr-code が認識されることを確認**

```bash
bun run check-types
```

Expected: エラーなし

**Step 3: MyQrDialog コンポーネントを作成**

`apps/web/components/my-qr-dialog.tsx` を新規作成:

```typescript
"use client";

import { QrCode } from "lucide-react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MyQrDialogProps {
  userId: string;
  userName: string;
}

export function MyQrDialog({ userId, userName }: MyQrDialogProps) {
  // window.location.origin is safe here because this is a Client Component
  // and only rendered in the browser
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/friends/add?userId=${userId}`
      : `/friends/add?userId=${userId}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <QrCode className="h-3.5 w-3.5" />
          QRコード
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>フレンド追加用QRコード</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-lg border p-4 bg-white">
            <QRCode value={url} size={200} />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            このQRコードをスキャンすると
            <br />
            {userName} さんにフレンド申請できます
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: 型チェックと lint**

```bash
bun run check-types && bun run check
```

Expected: エラーなし

**Step 5: コミット**

```bash
git add apps/web/components/my-qr-dialog.tsx apps/web/package.json bun.lock
git commit -m "feat: MyQrDialog コンポーネントを追加"
```

---

### Task 4: マイページにQRボタンを追加

**Files:**
- Modify: `apps/web/app/(sp)/sp/my/page.tsx`

**Step 1: マイページを開いて現在の構造を確認**

`apps/web/app/(sp)/sp/my/page.tsx` を読む。プロフィールヘッダー部分:

```typescript
// 現在の構造（プロフィールヘッダー部分）
<div className="flex flex-col items-center gap-5 py-6">
  <UserAvatar ... />
  <div className="text-center">
    <h1 ...>{user?.name}</h1>
    {userId && (
      <button ... onClick={handleCopyId}>
        // ユーザーIDコピーボタン
      </button>
    )}
  </div>
  <Link href="/sp/my/edit" ...>
    プロフィールを編集
  </Link>
</div>
```

**Step 2: MyQrDialog を import してボタンを追加**

import 文に追加:

```typescript
import { MyQrDialog } from "@/components/my-qr-dialog";
```

プロフィールヘッダー内の `<Link href="/sp/my/edit" ...>` の後に追加:

```typescript
{userId && user?.name && (
  <MyQrDialog userId={userId} userName={user.name} />
)}
```

**Step 3: 型チェックと lint**

```bash
bun run check-types && bun run check
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add apps/web/app/(sp)/sp/my/page.tsx
git commit -m "feat: マイページにQRコード表示ボタンを追加"
```

---

### Task 5: queryKeys に users.profile を追加

**Files:**
- Modify: `apps/web/lib/query-keys.ts`

**Step 1: query-keys.ts を開いて既存パターンを確認**

`apps/web/lib/query-keys.ts` を読み、既存の構造を確認する。

**Step 2: users エントリを追加**

`queryKeys` オブジェクトに `users` キーを追加:

```typescript
users: {
  all: ["users"] as const,
  profile: (userId: string) => ["users", "profile", userId] as const,
},
```

**Step 3: 型チェック**

```bash
bun run check-types
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add apps/web/lib/query-keys.ts
git commit -m "feat: queryKeys に users.profile を追加"
```

---

### Task 6: /friends/add 確認ページを作成

**Files:**
- Create: `apps/web/app/(authenticated)/friends/add/page.tsx`

**Step 1: 既存の (authenticated) layout を確認**

`apps/web/app/(authenticated)/` ディレクトリを確認し、未認証時のリダイレクト処理があるか確認する。
（あれば追加の認証チェックは不要。なければ `useSession` で guard する）

**Step 2: 確認ページを作成**

`apps/web/app/(authenticated)/friends/add/page.tsx` を新規作成:

```typescript
"use client";

import type { UserProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

export default function FriendsAddPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = pageTitle("フレンド申請");
  }, []);

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.users.profile(userId ?? ""),
    queryFn: () => api<UserProfileResponse>(`/api/users/${userId}/profile`),
    enabled: !!userId,
    retry: false,
  });

  if (!userId) {
    return (
      <div className="mt-4 mx-auto max-w-sm px-4">
        <p className="text-sm text-muted-foreground text-center">
          ユーザーIDが指定されていません
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 mx-auto max-w-sm px-4">
        <div className="flex flex-col items-center gap-6 rounded-lg border p-8">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mt-4 mx-auto max-w-sm px-4">
        <p className="text-sm text-muted-foreground text-center">
          ユーザーが見つかりません
        </p>
      </div>
    );
  }

  const isSelf = currentUserId === userId;

  async function handleSend() {
    setLoading(true);
    try {
      await api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeId: userId }),
      });
      setSent(true);
      toast.success(MSG.FRIEND_REQUEST_SENT);
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, MSG.FRIEND_REQUEST_SEND_FAILED, {
          conflict: "すでにフレンドか申請済みです",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 mx-auto max-w-sm px-4">
      <div className="flex flex-col items-center gap-6 rounded-lg border p-8">
        <UserAvatar
          name={profile.name}
          image={profile.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <div className="text-center">
          <h1 className="text-lg font-semibold">{profile.name}</h1>
        </div>
        {isSelf ? (
          <p className="text-sm text-muted-foreground">
            自分自身にはフレンド申請できません
          </p>
        ) : sent ? (
          <p className="text-sm text-muted-foreground">
            フレンド申請を送りました
          </p>
        ) : (
          <Button onClick={handleSend} disabled={loading} className="w-full">
            {loading ? "送信中..." : `${profile.name} さんにフレンド申請を送る`}
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 3: 型チェックと lint**

```bash
bun run check-types && bun run check
```

Expected: エラーなし

**Step 4: コミット**

```bash
git add apps/web/app/(authenticated)/friends/add/page.tsx
git commit -m "feat: QRスキャン後のフレンド申請確認ページを追加"
```

---

## 完了確認

全タスク完了後、以下で動作確認:

1. ローカル開発サーバーを起動: `bun run --filter @sugara/web dev`
2. マイページ (`/sp/my`) にアクセスして「QRコード」ボタンが表示されることを確認
3. QRコードをスキャン（または URL を直接入力）して `/friends/add?userId=<自分のID>` にアクセス
4. 「自分自身にはフレンド申請できません」と表示されることを確認
5. 別のユーザーIDで `/friends/add?userId=<他のユーザーID>` にアクセスして確認UI と申請ボタンが表示されることを確認

全テストが通ることを確認:

```bash
bun run test
```
