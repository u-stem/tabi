# 作戦会議（一時チャット）機能 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 旅行メンバーがアイデアを出し合うための一時的なチャット機能「作戦会議」を追加する

**Architecture:** DB にセッション/メッセージテーブルを追加し、Hono API ルートで CRUD を提供。既存の Supabase Realtime チャンネルに Broadcast イベントを追加してリアルタイム配信。右サイドバーとモバイルタブに UI を統合。

**Tech Stack:** Drizzle ORM, Hono, Zod, React Query, Supabase Realtime (Broadcast), shadcn/ui, Tailwind CSS v4

---

## Phase 1: バックエンド（スキーマ・API・テスト）

### Task 1: Zod スキーマ追加

**Files:**
- Create: `packages/shared/src/schemas/chat.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/limits.ts`

**Step 1: `packages/shared/src/schemas/chat.ts` を作成**

```ts
import { z } from "zod";

export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const CHAT_SESSION_TTL_HOURS = 72;

export const sendChatMessageSchema = z.object({
  content: z.string().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
});
```

**Step 2: `packages/shared/src/schemas/index.ts` にエクスポート追加**

末尾に追加:
```ts
export * from "./chat";
```

**Step 3: `packages/shared/src/limits.ts` を確認し、チャット関連の定数が必要か判断**

`CHAT_MESSAGE_MAX_LENGTH` と `CHAT_SESSION_TTL_HOURS` はスキーマファイル内で定義済みなので、limits.ts への追加は不要。

---

### Task 2: DB スキーマ追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`

**Step 1: chat_sessions テーブルと chat_messages テーブルを追加**

`schema.ts` 末尾の Relations セクションの直前に追加:

```ts
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id, { onDelete: "cascade" })
    .unique(),
  startedBy: uuid("started_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
}).enableRLS();

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_messages_session_id_created_at_idx").on(table.sessionId, table.createdAt)],
).enableRLS();
```

**Step 2: Relations を追加**

```ts
export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  trip: one(trips, { fields: [chatSessions.tripId], references: [trips.id] }),
  startedByUser: one(users, { fields: [chatSessions.startedBy], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, { fields: [chatMessages.sessionId], references: [chatSessions.id] }),
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}));
```

**Step 3: tripsRelations に chatSession を追加**

```ts
// 既存の tripsRelations に追加
chatSession: one(chatSessions, { fields: [trips.id], references: [chatSessions.tripId] }),
```

**Step 4: DB にスキーマ反映**

Run: `bun run db:push`

---

### Task 3: 共有型定義追加

**Files:**
- Modify: `packages/shared/src/types.ts`

**Step 1: ChatSession / ChatMessage の型を追加**

```ts
export type ChatSessionResponse = {
  id: string;
  startedBy: {
    userId: string;
    name: string;
    image?: string | null;
  };
  createdAt: string;
  lastMessageAt: string;
};

export type ChatMessageResponse = {
  id: string;
  userId: string;
  userName: string;
  userImage?: string | null;
  content: string;
  createdAt: string;
};
```

**Step 2: TripResponse に chatSession フィールドを追加**

```ts
// TripResponse に追加
chatSession: { id: string; lastMessageAt: string } | null;
```

---

### Task 4: API ルート実装 — セッション管理

**Files:**
- Create: `apps/api/src/routes/chat.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/lib/constants.ts`

**Step 1: `apps/api/src/lib/constants.ts` にエラーメッセージ追加**

```ts
// ERROR_MSG に追加
CHAT_SESSION_NOT_FOUND: "Chat session not found",
CHAT_SESSION_ALREADY_EXISTS: "Chat session already exists",
CHAT_SESSION_EXPIRED: "Chat session has expired",
CHAT_MESSAGE_EMPTY: "Message content is required",
```

**Step 2: `apps/api/src/routes/chat.ts` を作成**

セッション CRUD + メッセージ CRUD を1ファイルに実装。

```ts
import { and, desc, eq, lt } from "drizzle-orm";
import { Hono } from "hono";
import { CHAT_MESSAGE_MAX_LENGTH, CHAT_SESSION_TTL_HOURS, sendChatMessageSchema } from "@sugara/shared";
import { db } from "../db/index";
import { chatMessages, chatSessions, users } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { logActivity } from "../lib/activity-logger";
import { requireAuth } from "../middleware/auth";
import { requireTripAccess } from "../middleware/require-trip-access";
import type { AppEnv } from "../types";

const MESSAGES_PER_PAGE = 50;

const chatRoutes = new Hono<AppEnv>();
chatRoutes.use("*", requireAuth);

// Check TTL and delete expired session. Returns true if session was expired/deleted.
async function cleanupExpiredSession(tripId: string): Promise<boolean> {
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) return false;

  const ttlMs = CHAT_SESSION_TTL_HOURS * 60 * 60 * 1000;
  if (Date.now() - session.lastMessageAt.getTime() > ttlMs) {
    await db.delete(chatSessions).where(eq(chatSessions.id, session.id));
    return true;
  }
  return false;
}

// GET /:tripId/chat/session — get current session
chatRoutes.get("/:tripId/chat/session", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  await cleanupExpiredSession(tripId);

  const session = await db
    .select({
      id: chatSessions.id,
      startedByUserId: chatSessions.startedBy,
      startedByName: users.name,
      startedByImage: users.image,
      createdAt: chatSessions.createdAt,
      lastMessageAt: chatSessions.lastMessageAt,
    })
    .from(chatSessions)
    .innerJoin(users, eq(chatSessions.startedBy, users.id))
    .where(eq(chatSessions.tripId, tripId))
    .limit(1);

  if (session.length === 0) {
    return c.json({ session: null });
  }

  const s = session[0];
  return c.json({
    session: {
      id: s.id,
      startedBy: { userId: s.startedByUserId, name: s.startedByName, image: s.startedByImage },
      createdAt: s.createdAt.toISOString(),
      lastMessageAt: s.lastMessageAt.toISOString(),
    },
  });
});

// POST /:tripId/chat/session — start session
chatRoutes.post("/:tripId/chat/session", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  await cleanupExpiredSession(tripId);

  const existing = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (existing) {
    return c.json({ error: ERROR_MSG.CHAT_SESSION_ALREADY_EXISTS }, 409);
  }

  const [session] = await db
    .insert(chatSessions)
    .values({ tripId, startedBy: user.id })
    .returning();

  logActivity({
    tripId,
    userId: user.id,
    action: "created",
    entityType: "chat_session",
    entityName: "作戦会議",
  });

  return c.json({
    session: {
      id: session.id,
      startedBy: { userId: user.id, name: user.name, image: user.image },
      createdAt: session.createdAt.toISOString(),
      lastMessageAt: session.lastMessageAt.toISOString(),
    },
  }, 201);
});

// DELETE /:tripId/chat/session — end session (delete all)
chatRoutes.delete("/:tripId/chat/session", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) {
    return c.json({ error: ERROR_MSG.CHAT_SESSION_NOT_FOUND }, 404);
  }

  await db.delete(chatSessions).where(eq(chatSessions.id, session.id));

  logActivity({
    tripId,
    userId: user.id,
    action: "deleted",
    entityType: "chat_session",
    entityName: "作戦会議",
  });

  return c.body(null, 204);
});

// GET /:tripId/chat/messages — list messages (cursor pagination)
chatRoutes.get("/:tripId/chat/messages", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");
  await cleanupExpiredSession(tripId);

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) {
    return c.json({ items: [], nextCursor: null });
  }

  const limit = MESSAGES_PER_PAGE;
  const cursor = c.req.query("cursor");
  if (cursor && Number.isNaN(Date.parse(cursor))) {
    return c.json({ error: "Invalid cursor" }, 400);
  }

  const whereConditions = cursor
    ? and(eq(chatMessages.sessionId, session.id), lt(chatMessages.createdAt, new Date(cursor)))
    : eq(chatMessages.sessionId, session.id);

  const messages = await db
    .select({
      id: chatMessages.id,
      userId: chatMessages.userId,
      userName: users.name,
      userImage: users.image,
      content: chatMessages.content,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .where(whereConditions)
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit + 1);

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return c.json({
    items: items.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    nextCursor,
  });
});

// POST /:tripId/chat/messages — send message
chatRoutes.post("/:tripId/chat/messages", requireTripAccess("editor"), async (c) => {
  const tripId = c.req.param("tripId");
  const user = c.get("user");

  await cleanupExpiredSession(tripId);

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.tripId, tripId),
  });
  if (!session) {
    return c.json({ error: ERROR_MSG.CHAT_SESSION_NOT_FOUND }, 404);
  }

  const body = await c.req.json();
  const parsed = sendChatMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId: session.id,
      userId: user.id,
      content: parsed.data.content,
    })
    .returning();

  await db
    .update(chatSessions)
    .set({ lastMessageAt: message.createdAt })
    .where(eq(chatSessions.id, session.id));

  return c.json(
    {
      id: message.id,
      userId: user.id,
      userName: user.name,
      userImage: user.image,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    },
    201,
  );
});

export { chatRoutes };
```

**Step 3: `apps/api/src/app.ts` にルート登録**

```ts
import { chatRoutes } from "./routes/chat";
// ...
app.route("/api/trips", chatRoutes);
```

---

### Task 5: trip 詳細 API に chatSession サマリーを追加

**Files:**
- Modify: `apps/api/src/routes/trips.ts`

trip 詳細取得の GET `/:tripId` レスポンスに `chatSession` フィールドを追加。
既存のクエリに chatSessions テーブルの LEFT JOIN か後続クエリを追加。

```ts
// trip 詳細取得内で
const chatSession = await db.query.chatSessions.findFirst({
  where: eq(chatSessions.tripId, tripId),
  columns: { id: true, lastMessageAt: true },
});

// レスポンスに追加
chatSession: chatSession ? { id: chatSession.id, lastMessageAt: chatSession.lastMessageAt.toISOString() } : null,
```

---

### Task 6: API テスト

**Files:**
- Create: `apps/api/src/__tests__/chat.test.ts`

テスト対象:
1. GET session — セッションなしで `{ session: null }` を返す
2. POST session — editor がセッション開始できる
3. POST session — viewer は 404
4. POST session — 既存セッションがある場合 409
5. DELETE session — セッション削除で 204
6. DELETE session — セッションなしで 404
7. POST messages — メッセージ送信で 201
8. POST messages — セッションなしで 404
9. POST messages — 空メッセージで 400
10. GET messages — メッセージ一覧を降順で返す
11. GET messages — セッションなしで空配列

既存の `reactions.test.ts` のパターンに従い、`vi.hoisted` + `vi.mock` + `createTestApp` を使用。

Run: `bun run --filter @sugara/api test`

---

### Task 7: Phase 1 レビュー & コミット

- superpowers:requesting-code-review でレビュー実施
- 問題を解消後コミット:
  - `feat: 作戦会議のバックエンド実装（スキーマ・API・テスト）`

---

## Phase 2: フロントエンド（UI コンポーネント・統合）

### Task 8: フロントエンドの定数・メッセージ・クエリキー追加

**Files:**
- Modify: `apps/web/lib/messages.ts`
- Modify: `apps/web/lib/query-keys.ts`

**Step 1: `apps/web/lib/messages.ts` に追加**

```ts
// Chat
CHAT_SESSION_STARTED: "作戦会議を開始しました",
CHAT_SESSION_START_FAILED: "作戦会議の開始に失敗しました",
CHAT_SESSION_ENDED: "作戦会議を終了しました",
CHAT_SESSION_END_FAILED: "作戦会議の終了に失敗しました",
CHAT_MESSAGE_SEND_FAILED: "メッセージの送信に失敗しました",
CHAT_SESSION_ALREADY_EXISTS: "作戦会議はすでに開始されています",
CHAT_EMPTY: "メッセージはまだありません",
CHAT_NO_SESSION: "作戦会議は開始されていません",
```

**Step 2: `apps/web/lib/query-keys.ts` に追加**

```ts
// trips 内に追加
chatSession: (tripId: string) => [...queryKeys.trips.all, tripId, "chat-session"] as const,
chatMessages: (tripId: string) => [...queryKeys.trips.all, tripId, "chat-messages"] as const,
```

---

### Task 9: 作戦会議パネル UI コンポーネント

**Files:**
- Create: `apps/web/components/chat-panel.tsx`

チャットパネルの全体構成:
- セッションなし → 「作戦会議を開始」ボタン
- セッションあり → メッセージ一覧 + 入力欄 + 「作戦会議を終了」ボタン
- メッセージはuseInfiniteQueryでカーソルページネーション（古い方向にスクロール）
- 送信は useMutation + Broadcast
- 受信は既存 `trip:{tripId}` チャンネルの `chat:message` Broadcast を listen

主な実装ポイント:
- セッション取得: `useQuery({ queryKey: queryKeys.trips.chatSession(tripId) })`
- メッセージ取得: `useInfiniteQuery({ queryKey: queryKeys.trips.chatMessages(tripId) })`
- メッセージ送信後: API レスポンスをキャッシュに楽観追加 + Broadcast
- Broadcast 受信時: メッセージをキャッシュに追加（API 不要）
- 自動スクロール: 新メッセージで最下部にスクロール
- 入力: textarea + Enter 送信 (Shift+Enter で改行)

---

### Task 10: Realtime チャットイベント対応

**Files:**
- Modify: `apps/web/lib/hooks/use-trip-sync.ts`

既存の `useTripSync` に `chat:message` と `chat:session` の Broadcast リスナーを追加。
コールバックを新しい引数として受け取るか、返り値に `channelRef` を公開して外部からリスナー登録できるようにする。

推奨アプローチ: `useTripSync` の返り値に `channel` (RealtimeChannel) を公開し、`ChatPanel` 内で直接 `.on("broadcast", { event: "chat:message" }, handler)` を呼ぶ。
ただし、channel の lifecycle が `useTripSync` 内で管理されているため、channelRef を公開する形が安全。

代替: `ChatPanel` で独自に同じ `trip:{tripId}` チャンネルを subscribe する。Supabase は同名チャンネルに対して既存インスタンスを返すので、二重接続にはならない。

最もシンプルな方法: `useTripSync` のオプションに `onChatMessage` / `onChatSession` コールバックを追加。

```ts
// useTripSync に追加するオプション
onChatMessage?: (message: ChatMessageResponse) => void;
onChatSession?: (action: "started" | "ended") => void;
```

channel 初期化部分に追加:
```ts
.on("broadcast", { event: "chat:message" }, ({ payload }) => {
  onChatMessageRef.current?.(payload);
})
.on("broadcast", { event: "chat:session" }, ({ payload }) => {
  onChatSessionRef.current?.(payload.action);
})
```

---

### Task 11: 右サイドバー・モバイルタブへの統合

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel-tabs.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx`
- Modify: `apps/web/components/mobile-content-tabs.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: RightPanelTab に "chat" を追加**

`right-panel-tabs.tsx`:
```ts
export type RightPanelTab = "candidates" | "activity" | "bookmarks" | "expenses" | "chat";
```

「作戦会議」ボタンをタブリストに追加。chatSession の有無でドット表示など任意。

**Step 2: RightPanel に ChatPanel を追加**

```tsx
// right-panel.tsx
rightPanelTab === "chat" ? (
  <ChatPanel tripId={tripId} canEdit={canEdit} broadcastChange={broadcastChange} />
) : rightPanelTab === "candidates" ? (
  ...
```

**Step 3: MobileContentTab に "chat" を追加**

```ts
export type MobileContentTab = "schedule" | "candidates" | "expenses" | "chat";
```

TABS 配列に `{ id: "chat", label: "作戦会議" }` を追加。

**Step 4: page.tsx でチャットリアルタイムイベントの配線**

`useTripSync` に `onChatMessage` / `onChatSession` を渡し、それぞれ React Query のキャッシュ更新を行う。

```ts
const onChatMessage = useCallback((message: ChatMessageResponse) => {
  queryClient.setQueryData(queryKeys.trips.chatMessages(tripId), (old) => {
    // 最新ページの先頭にメッセージを追加
  });
}, [queryClient, tripId]);

const onChatSession = useCallback((action: "started" | "ended") => {
  queryClient.invalidateQueries({ queryKey: queryKeys.trips.chatSession(tripId) });
  if (action === "ended") {
    queryClient.setQueryData(queryKeys.trips.chatMessages(tripId), undefined);
  }
}, [queryClient, tripId]);
```

---

### Task 12: 送信時の Broadcast 配信

**Files:**
- Modify: `apps/web/components/chat-panel.tsx`

メッセージ送信の useMutation の `onSuccess` で:

```ts
broadcastChange(); // trip:updated (既存のアクティビティログ更新用)
channel.send({
  type: "broadcast",
  event: "chat:message",
  payload: messageResponse, // API レスポンスをそのまま
});
```

セッション開始/終了時:
```ts
channel.send({
  type: "broadcast",
  event: "chat:session",
  payload: { action: "started" }, // or "ended"
});
```

---

### Task 13: Phase 2 レビュー & コミット

- superpowers:requesting-code-review でレビュー実施
- 問題を解消後コミット:
  - `feat: 作戦会議のフロントエンド実装（UIパネル・リアルタイム配信）`

---

## Phase 3: 統合テスト・仕上げ

### Task 14: 全体動作確認

- `bun run --filter @sugara/api test` でバックエンドテスト実行
- `bun run check-types` で型チェック
- `bun run lint` で lint チェック

### Task 15: Phase 3 レビュー & 最終コミット

- superpowers:requesting-code-review で最終レビュー
- 設計ドキュメント `docs/plans/2026-02-23-strategy-meeting-design.md` を更新（実装済みマーク）
- 必要に応じて追加コミット
