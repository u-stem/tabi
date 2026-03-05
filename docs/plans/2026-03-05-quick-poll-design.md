# Quick Poll - 設計ドキュメント

旅行に紐づかない独立した投票機能。グループでの即席の意思決定（二択、複数候補、Yes/No）をリアルタイムで行える。

## データモデル

### quick_polls

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| creatorId | uuid, FK -> users | |
| shareToken | text, unique | 共有URL用 |
| question | text, max 200 | |
| allowMultiple | boolean, default false | 複数選択可か |
| showResultsBeforeVote | boolean, default true | 投票前に結果表示するか |
| status | enum: open / closed | |
| closedAt | timestamp | |
| expiresAt | timestamp | 作成から7日後 |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### quick_poll_options

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| pollId | uuid, FK -> quick_polls, cascade | |
| label | text, max 100 | |
| sortOrder | integer | |

### quick_poll_votes

| Column | Type | Notes |
|--------|------|-------|
| id | uuid, PK | |
| pollId | uuid, FK -> quick_polls, cascade | |
| optionId | uuid, FK -> quick_poll_options, cascade | |
| userId | uuid, FK -> users, nullable | ログインユーザー |
| anonymousId | text, nullable | ブラウザ生成UUID (localStorage) |
| createdAt | timestamp | |

**制約:**
- `CHECK (userId IS NOT NULL OR anonymousId IS NOT NULL)`
- `unique(pollId, optionId, userId) WHERE userId IS NOT NULL`
- `unique(pollId, optionId, anonymousId) WHERE anonymousId IS NOT NULL`
- `allowMultiple=false` 時の1人1票制約はアプリ層で制御

## API エンドポイント

### 管理系（要認証）

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/quick-polls | 投票作成 |
| GET | /api/quick-polls | 自分の投票一覧 |
| PATCH | /api/quick-polls/:id | 投票更新（クローズなど） |
| DELETE | /api/quick-polls/:id | 投票削除 |

### 参加系（認証不要、共有トークン経由）

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/quick-polls/s/:shareToken | 投票情報取得 |
| POST | /api/quick-polls/s/:shareToken/vote | 投票する |
| DELETE | /api/quick-polls/s/:shareToken/vote | 投票取り消し |

## リアルタイム同期

Supabase Realtime Broadcast を使用。

- チャンネル名: `quick-poll:{shareToken}`
- イベント: `poll:voted`（投票更新）、`poll:closed`（クローズ）
- Broadcast はトリガーのみ、データは API から再取得

## フロントエンド

### ページ構成

| Path | Description | Auth |
|------|-------------|------|
| /polls/new | 投票作成 | 必須 |
| /polls | 自分の投票一覧 | 必須 |
| /p/:shareToken | 投票参加・結果表示 | 不要 |

### /p/:shareToken（メイン画面）

- 1画面完結: 質問 + 選択肢 + 投票ボタン + リアルタイム結果
- 投票済み選択肢はハイライト
- showResultsBeforeVote=false の場合、投票前はバー非表示
- 作成者にはクローズボタン
- クローズ済みは結果のみ表示

### /polls/new（作成画面）

- 質問入力
- 選択肢を動的に追加/削除（2〜10個）
- 「Yes/No で聞く」ボタン → 選択肢自動セット
- allowMultiple / showResultsBeforeVote トグル
- 作成後に共有URLコピーダイアログ

### /polls（一覧画面）

- 自分の投票カード一覧
- ステータスフィルタ
- 共有URLコピー、クローズ、削除

## 期限切れ処理

- expiresAt は作成から7日後
- API 取得時に期限切れを closed 扱い（DB 更新はしない）
- 物理削除バッチは初期実装では不要

## テスト

結合テスト (`apps/api/src/__tests__/quick-polls.test.ts`):
- 投票の CRUD
- 共有トークンでの投票取得・投票実行
- 重複投票防止（認証/匿名）
- allowMultiple の挙動
- クローズ済み投票への投票拒否
- 作成者のみがクローズ・削除可能

## スコープ外（YAGNI）

- 投票の編集（選択肢の追加/変更）
- 画像付き選択肢
- コメント機能
- 投票の埋め込み（iframe）
- Push 通知
- 期限切れデータの自動削除バッチ
