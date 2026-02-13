# フレンド機能 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 相互承認型フレンド機能を追加し、旅行メンバー追加時にフレンドから選択できるようにする

**Architecture:** friends テーブルを追加し、リクエスト/承認フローを API で実装。フレンド管理は独立ページ `/friends`。メンバー追加ダイアログにフレンドタブを追加。

**Tech Stack:** Drizzle ORM, Hono, Zod, React, shadcn/ui (Tabs)

---

### Task 1: 共有スキーマ・型・定数の追加

**Files:**
- Create: `packages/shared/src/schemas/friend.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/limits.ts`

**Step 1: フレンドスキーマを作成**

`packages/shared/src/schemas/friend.ts`:
```typescript
import { z } from "zod";

export const friendRequestSchema = z.object({
  addresseeId: z.string().uuid(),
});

export const acceptFriendRequestSchema = z.object({
  status: z.literal("accepted"),
});
```

**Step 2: スキーマを re-export**

`packages/shared/src/schemas/index.ts` に追加:
```typescript
export * from "./friend";
```

**Step 3: 型を追加**

`packages/shared/src/types.ts` に追加:
```typescript
export type FriendResponse = {
  friendId: string;
  userId: string;
  name: string;
};

export type FriendRequestResponse = {
  id: string;
  requesterId: string;
  name: string;
  createdAt: string;
};
```

**Step 4: 上限定数を追加**

`packages/shared/src/limits.ts` に追加:
```typescript
export const MAX_FRIENDS_PER_USER = 100;
```

**Step 5: コミット**

```
feat: フレンド機能の共有スキーマ・型・定数を追加
```

---

### Task 2: DB スキーマの追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: friends テーブルと enum を追加**

`apps/api/src/db/schema.ts` に追加:

enum (既存の enum 定義の近くに):
```typescript
export const friendStatusEnum = pgEnum("friend_status", ["pending", "accepted"]);
```

テーブル (既存テーブル定義の後に):
```typescript
export const friends = pgTable("friends", {
  id: uuid("id").primaryKey().defaultRandom(),
  requesterId: uuid("requester_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  addresseeId: uuid("addressee_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: friendStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}).enableRLS();
```

リレーション:
```typescript
export const friendsRelations = relations(friends, ({ one }) => ({
  requester: one(users, { fields: [friends.requesterId], references: [users.id], relationName: "friendRequester" }),
  addressee: one(users, { fields: [friends.addresseeId], references: [users.id], relationName: "friendAddressee" }),
}));
```

usersRelations に追加:
```typescript
export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  tripMembers: many(tripMembers),
  sentFriendRequests: many(friends, { relationName: "friendRequester" }),
  receivedFriendRequests: many(friends, { relationName: "friendAddressee" }),
}));
```

**Step 2: DB スキーマを反映**

Run: `bun run db:push`

**Step 3: コミット**

```
feat: friends テーブルを追加
```

---

### Task 3: API エラーメッセージの追加

**Files:**
- Modify: `apps/api/src/lib/constants.ts`

**Step 1: フレンド関連のエラーメッセージを追加**

`apps/api/src/lib/constants.ts` の `ERROR_MSG` に追加:
```typescript
CANNOT_FRIEND_SELF: "Cannot send friend request to yourself",
ALREADY_FRIENDS: "Already friends or request pending",
FRIEND_REQUEST_NOT_FOUND: "Friend request not found",
FRIEND_NOT_FOUND: "Friend not found",
LIMIT_FRIENDS: "Friend limit reached",
```

**Step 2: コミット**

```
feat: フレンド機能のエラーメッセージを追加
```

---

### Task 4: フレンド API ルートの実装 (TDD)

**Files:**
- Create: `apps/api/src/routes/friends.ts`
- Create: `apps/api/src/__tests__/friends.test.ts`
- Modify: `apps/api/src/app.ts`

**Step 1: テストファイルを作成**

`apps/api/src/__tests__/friends.test.ts` を作成。
テストパターンは `members.test.ts` と同様:
- `vi.hoisted` で mock を定義
- `vi.mock("../lib/auth")`, `vi.mock("../db/index")` で DB/auth をモック
- `createTestApp` でテスト用 Hono アプリを構築
- `beforeEach` で `vi.clearAllMocks()` と認証モック設定

テストケース:

**GET /api/friends**
- 200: フレンド一覧を返す (status=accepted のみ、requester/addressee 双方向で取得)
- 200: フレンドがいない場合は空配列
- 401: 未認証

**GET /api/friends/requests**
- 200: 受信リクエスト一覧を返す (status=pending, addresseeId=自分)
- 200: リクエストがない場合は空配列

**POST /api/friends/requests**
- 201: リクエスト送信成功
- 400: 自分自身へのリクエスト
- 400: 無効な UUID
- 404: 相手ユーザーが存在しない
- 409: 既にフレンドまたは申請済み
- 409: フレンド上限到達

**PATCH /api/friends/requests/:id**
- 200: リクエスト承認成功
- 404: リクエストが存在しない
- 403: addressee でない (requester が承認しようとした)

**DELETE /api/friends/requests/:id**
- 200: addressee がリクエスト拒否
- 200: requester がリクエスト取り消し
- 404: リクエストが存在しない
- 403: 無関係のユーザーが削除しようとした

**DELETE /api/friends/:friendId**
- 200: フレンド解除成功 (requester 側)
- 200: フレンド解除成功 (addressee 側)
- 404: フレンドが存在しない

**Step 2: テストが失敗することを確認**

Run: `bun run --filter @sugara/api test -- friends.test.ts`

**Step 3: ルートファイルを実装**

`apps/api/src/routes/friends.ts`:

```typescript
import { acceptFriendRequestSchema, friendRequestSchema, MAX_FRIENDS_PER_USER } from "@sugara/shared";
import { and, count, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { friends, users } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const friendRoutes = new Hono<AppEnv>();
friendRoutes.use("*", requireAuth);

// List accepted friends
friendRoutes.get("/", async (c) => { ... });

// List received friend requests (pending)
friendRoutes.get("/requests", async (c) => { ... });

// Send friend request
friendRoutes.post("/requests", async (c) => { ... });

// Accept friend request (addressee only)
friendRoutes.patch("/requests/:id", async (c) => { ... });

// Reject/cancel friend request
friendRoutes.delete("/requests/:id", async (c) => { ... });

// Remove friend
friendRoutes.delete("/:friendId", async (c) => { ... });

export { friendRoutes };
```

各エンドポイントの実装詳細:

**GET /**: `friends` テーブルから `status=accepted` かつ `requesterId=me OR addresseeId=me` を取得。相手の user 情報を join して返す。

**GET /requests**: `friends` テーブルから `status=pending` かつ `addresseeId=me` を取得。requester の user 情報を join して返す。

**POST /requests**: バリデーション (self-check, user exists, duplicate check with OR condition for both directions, friend count limit)。insert して 201 を返す。

**PATCH /requests/:id**: レコード取得、addressee であることを確認、status を accepted に更新。

**DELETE /requests/:id**: レコード取得、requester か addressee であることを確認、レコード削除。

**DELETE /:friendId**: レコード取得 (status=accepted)、requester か addressee であることを確認、レコード削除。

**Step 4: app.ts にルートを登録**

`apps/api/src/app.ts` に追加:
```typescript
import { friendRoutes } from "./routes/friends";
// ...
app.route("/api/friends", friendRoutes);
```

**Step 5: テストが全て通ることを確認**

Run: `bun run --filter @sugara/api test -- friends.test.ts`

**Step 6: 全テスト通過を確認**

Run: `bun run test`

**Step 7: コミット**

```
feat: フレンド API ルートを実装
```

---

### Task 5: フロントエンド メッセージ定数の追加

**Files:**
- Modify: `apps/web/lib/messages.ts`

**Step 1: フレンド関連のメッセージを追加**

`apps/web/lib/messages.ts` の `MSG` に追加:
```typescript
// Friend
FRIEND_REQUEST_SENT: "フレンド申請を送信しました",
FRIEND_REQUEST_SEND_FAILED: "フレンド申請の送信に失敗しました",
FRIEND_REQUEST_ACCEPTED: "フレンド申請を承認しました",
FRIEND_REQUEST_ACCEPT_FAILED: "フレンド申請の承認に失敗しました",
FRIEND_REQUEST_REJECTED: "フレンド申請を拒否しました",
FRIEND_REQUEST_REJECT_FAILED: "フレンド申請の拒否に失敗しました",
FRIEND_REQUEST_CANCELLED: "フレンド申請を取り消しました",
FRIEND_REQUEST_CANCEL_FAILED: "フレンド申請の取り消しに失敗しました",
FRIEND_REMOVED: "フレンドを解除しました",
FRIEND_REMOVE_FAILED: "フレンドの解除に失敗しました",
FRIEND_LIST_FAILED: "フレンド一覧の取得に失敗しました",
FRIEND_REQUESTS_FAILED: "フレンド申請一覧の取得に失敗しました",
LIMIT_FRIENDS: `フレンドは最大${MAX_FRIENDS_PER_USER}人まで登録できます`,
```

`MAX_FRIENDS_PER_USER` を import に追加。

**Step 2: コミット**

```
feat: フレンド機能のフロントエンドメッセージを追加
```

---

### Task 6: フレンド管理ページの実装

**Files:**
- Create: `apps/web/app/(authenticated)/friends/page.tsx`
- Modify: `apps/web/components/header.tsx`

**Step 1: フレンド管理ページを作成**

`apps/web/app/(authenticated)/friends/page.tsx`:

3つのセクションを持つページ:

1. **受信リクエスト** (`GET /api/friends/requests`):
   - リクエスト一覧。各行に申請者名 + 承認/拒否ボタン
   - リクエストがなければセクション非表示

2. **フレンド一覧** (`GET /api/friends`):
   - フレンド一覧。各行に名前 + 解除ボタン (AlertDialog で確認)
   - フレンドがいなければ「フレンドがいません」表示

3. **フレンド申請フォーム**:
   - ユーザーID 入力 + 申請ボタン
   - `POST /api/friends/requests` で送信

**Step 2: ヘッダーにナビゲーションリンクを追加**

`apps/web/components/header.tsx` の `NAV_LINKS` に追加:
```typescript
{ href: "/friends", label: "フレンド", icon: UserPlus },
```

`UserPlus` を lucide-react の import に追加。

受信リクエスト数のバッジ表示は、ヘッダーコンポーネントで `/api/friends/requests` を fetch してカウントを表示。バッジは簡素に、リンクの横に数字を表示する程度。

**Step 3: コミット**

```
feat: フレンド管理ページとナビゲーションを追加
```

---

### Task 7: メンバー追加ダイアログの改修

**Files:**
- Modify: `apps/web/components/member-dialog.tsx`

**Step 1: タブ構成に変更**

shadcn/ui の Tabs コンポーネントを使用。

- **「フレンドから」タブ** (デフォルト):
  - `GET /api/friends` でフレンド一覧を取得
  - 各行に名前 + ロール選択 (editor/viewer) + 追加ボタン
  - 既にメンバーの人はグレーアウト (members 配列と突き合わせ)
  - フレンドがいない場合は「フレンドがいません。ユーザーIDで追加タブから追加できます。」

- **「ユーザーIDで追加」タブ**:
  - 現状の UUID 入力フォームをそのまま使用
  - 「フレンド申請も送る」チェックボックスを追加 (デフォルト ON)
  - チェック ON の場合、メンバー追加成功時に `POST /api/friends/requests` も実行 (エラーは無視 = 既にフレンドの場合など)

**Step 2: コミット**

```
feat: メンバー追加ダイアログにフレンドタブを追加
```

---

### Task 8: 型チェック・lint・全テスト

**Step 1: 型チェック**

Run: `bun run check-types`

**Step 2: lint/format**

Run: `bun run check`

**Step 3: 全テスト**

Run: `bun run test`

**Step 4: 問題があれば修正してコミット**
