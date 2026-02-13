# Candidate Reactions Design

**Goal:** 候補スポットにメンバーが「行きたい」「うーん」のリアクションを付けて、行き先の意思決定を支援する

**Tech Stack:** Hono, Drizzle ORM, Supabase Realtime (Broadcast), React

---

## Data Model

`schedule_reactions` テーブルを新規作成する。

```sql
CREATE TYPE reaction_type AS ENUM ('like', 'hmm');

CREATE TABLE schedule_reactions (
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        reaction_type NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (schedule_id, user_id)
);
```

- 複合主キーで 1 ユーザー 1 候補につき 1 リアクションを保証
- `like` = 👍（行きたい）、`hmm` = 🤔（うーん）
- 同じボタンを再度押すと DELETE（中立に戻る）
- 違うボタンを押すと UPDATE（切り替え）

Relations:

```ts
scheduleReactionsRelations = relations(scheduleReactions, ({ one }) => ({
  schedule: one(schedules, ...),
  user: one(users, ...),
}))
```

---

## API

### PUT /api/trips/:tripId/candidates/:scheduleId/reaction

リアクションの追加・変更（UPSERT）。

- **Auth:** `requireAuth` + `checkTripAccess`（viewer 以上）
- **Body:** `{ type: "like" | "hmm" }`
- **Response:** `{ type, likeCount, hmmCount }`
- **Logic:**
  1. 対象 schedule が候補（`dayPatternId IS NULL`）であることを検証
  2. `INSERT ... ON CONFLICT (schedule_id, user_id) DO UPDATE SET type = $type`
  3. 集計を返す
  4. Realtime Broadcast で通知

### DELETE /api/trips/:tripId/candidates/:scheduleId/reaction

リアクションの取り消し。

- **Auth:** 同上
- **Response:** `{ likeCount, hmmCount }`
- **Logic:**
  1. 行を削除
  2. 集計を返す
  3. Realtime Broadcast で通知

### GET /api/trips/:tripId/candidates（既存の拡張）

レスポンスの各候補に以下を追加:

```ts
{
  // existing fields...
  likeCount: number;
  hmmCount: number;
  myReaction: "like" | "hmm" | null;
}
```

`LEFT JOIN` + `COUNT FILTER` で 1 クエリにまとめる。

---

## UI

### 候補カード（CandidateCard）

```
┌─────────────────────────────────────────┐
│ ⠿  金閣寺                 👍 2  🤔 0  ⋯ │
│    観光                                  │
└─────────────────────────────────────────┘
```

- 👍 / 🤔 はネイティブ絵文字をボタン内に直接表示
- 自分がリアクション済みのボタンは `bg-accent` で強調
- 未リアクションは `variant="ghost"`
- モバイルではカウントを非表示（`hidden sm:inline` パターン）
- 選択モード / disabled / 共有ビュー時はリアクションボタン非表示

### 候補パネルのソート

ヘッダーにソートオプションを追加:

- **作成順**（デフォルト、現状通り）
- **人気順**（👍 数降順 → 🤔 数昇順）

### Realtime

既存の Supabase Realtime Broadcast → `onRefresh` パターンに乗せる。リアクション変更時に `candidates:updated` イベントを送信し、他メンバーの候補一覧を再取得させる。

---

## Shared Schema

`packages/shared` に追加:

```ts
export const reactionTypeEnum = ["like", "hmm"] as const;
export type ReactionType = (typeof reactionTypeEnum)[number];

export const reactionSchema = z.object({
  type: z.enum(reactionTypeEnum),
});

// CandidateResponse の拡張
export type CandidateResponse = ScheduleResponse & {
  likeCount: number;
  hmmCount: number;
  myReaction: ReactionType | null;
};
```

---

## Scope Out

- 予定（スケジュール済み）へのリアクション -- 候補のみに限定
- リアクションしたユーザーの一覧表示 -- カウントのみ表示
- 通知 -- Realtime で即時反映されるため不要
