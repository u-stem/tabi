# 日程調整機能 設計

## 概要

旅行の日程をメンバー間で調整する機能。候補日投票型（調整さん方式）で、OK / 未定 / NG の3段階で回答する。確定すると旅行が自動作成される。

既存の「オーナーが日程を決めて直接作成」するフローと共存する。

## ライフサイクル

```
日程調整作成 → 参加者招待 → 回答収集 → 日程確定 → 旅行自動作成
```

ステータス: `open`（回答受付中）→ `confirmed`（確定・旅行作成済み）→ `closed`（手動で閉じた）

## データモデル

### schedule_polls

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid PK | |
| ownerId | uuid FK → users | 作成者 |
| title | varchar(100) | "夏の沖縄旅行" |
| destination | varchar(100) | "沖縄" |
| note | text | 任意のメモ |
| status | enum(open, confirmed, closed) | |
| deadline | timestamptz | 回答締め切り（NULL = なし） |
| shareToken | varchar(64) UNIQUE | 共有リンク用 |
| confirmedOptionId | uuid FK → schedule_poll_options | 確定した候補 |
| tripId | uuid FK → trips | 確定後に作成された旅行 |
| createdAt | timestamptz | |
| updatedAt | timestamptz | |

### schedule_poll_options

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid PK | |
| pollId | uuid FK → schedule_polls | |
| startDate | date | |
| endDate | date | |
| sortOrder | integer | |

制約: `endDate >= startDate`

### schedule_poll_participants

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid PK | |
| pollId | uuid FK → schedule_polls | |
| userId | uuid FK → users | NULL = ゲスト |
| guestName | varchar(50) | 共有リンク経由のゲスト名 |

制約: 同一 poll 内で userId が一意（ゲストは guestName で識別）

### schedule_poll_responses

| カラム | 型 | 説明 |
|--------|------|------|
| participantId | uuid FK → schedule_poll_participants | 複合PK |
| optionId | uuid FK → schedule_poll_options | 複合PK |
| response | enum(ok, maybe, ng) | |

## API エンドポイント

### 日程調整 CRUD

```
POST   /api/polls                              作成
GET    /api/polls                              一覧（自分が作成 + 招待された調整）
GET    /api/polls/:pollId                      詳細（候補・参加者・回答を含む）
PATCH  /api/polls/:pollId                      更新（タイトル・メモ・締め切り等、openのみ）
DELETE /api/polls/:pollId                      削除（オーナーのみ）
```

### 候補日程（open時、オーナーのみ）

```
POST   /api/polls/:pollId/options              候補追加
DELETE /api/polls/:pollId/options/:optionId     候補削除
```

### 参加者管理（オーナーのみ）

```
POST   /api/polls/:pollId/participants         招待（userId指定）
DELETE /api/polls/:pollId/participants/:id      参加者削除
```

### 回答

```
PUT    /api/polls/:pollId/responses            全候補への回答を一括送信
         body: { responses: [{ optionId, response }] }
```

### 共有リンク

```
POST   /api/polls/:pollId/share                共有トークン生成（オーナーのみ）
GET    /api/polls/shared/:token                共有リンク経由で詳細取得（認証不要）
POST   /api/polls/shared/:token/responses      ゲスト回答（guestName + responses）
```

### 日程確定

```
POST   /api/polls/:pollId/confirm              確定（optionId指定、オーナーのみ）
```

確定時のトランザクション:
1. `poll.status = confirmed`, `confirmedOptionId = optionId`
2. 旅行作成（title, destination, startDate, endDate を poll + option から取得）
3. 参加者（userId 有り）を trip_members に editor として追加
4. `poll.tripId = 作成された旅行ID`

ゲスト参加者（userId 無し）は旅行メンバーに追加されない。

## フロントエンド

### ページ構成

| パス | 説明 |
|------|------|
| `/polls/new` | 日程調整作成フォーム |
| `/polls/[pollId]` | 調整詳細（結果表示 + 回答入力） |
| `/polls/shared/[token]` | 共有リンク経由（ゲスト回答可） |

### ホーム画面の変更

- 「新規作成」ボタンをドロップダウンに変更
  - 「旅行を作成」: 現状通り直接作成
  - 「日程調整から始める」: `/polls/new` へ遷移
- `GET /api/polls` と `GET /api/trips` を並列取得し、`updatedAt` でマージ表示
- PollCard コンポーネント新規作成
  - タイトル・行き先
  - 「日程調整中」バッジ
  - 回答状況: `${回答済み人数}/${参加者数}人回答済`
  - 締め切り: `あと◯日` / `締め切り済み` / なし
  - クリック → `/polls/[pollId]`
- ステータスフィルタに「日程調整中」を追加

### 回答マトリクス

調整詳細画面のメインコンポーネント。調整さんと同様のテーブル形式。

```
              候補A       候補B       候補C
              8/1〜8/3    8/8〜8/10   8/15〜8/17
田中          OK          NG          OK
佐藤          OK          未定         OK
鈴木          OK          OK          未定
ゲスト1       OK          NG          OK
─────────────────────────────────────────────
OK            4/4         2/4         3/4
```

- 全員OKの候補にハイライト表示
- オーナーは任意の候補を確定可能（全員OKでなくても強制確定可）
- モバイルでは横スクロール対応

### 招待方法

- フレンド一覧 / グループ一覧から選択（member-dialog と同様のUI）
- 共有リンク発行（trip の共有リンクと同様のパターン）
- ログインユーザーが共有リンク経由でアクセスした場合は自動で紐付け

### 締め切り

- 作成時に任意で日時を設定
- 締め切り後は新規回答・回答変更が不可（API でバリデーション）
- 詳細画面に「あと◯日」または「締め切り済み」を表示
- オーナーは締め切り後も確定操作が可能
- オーナーは締め切りを後から変更可能（延長・短縮・解除）

## ナビゲーション

変更なし（ホーム / ブックマーク / フレンド の3つのまま）。日程調整はホーム画面に統合表示される。

## スコープ

旅行特化。将来の汎用化はデータモデルで対応可能（tripId が NULL のまま confirmed にすることで旅行を作らずに確定できる）。
