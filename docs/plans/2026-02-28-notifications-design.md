# 通知機能 設計ドキュメント

## 概要

旅行計画アプリ sugara に、アプリ内通知とブラウザ push 通知を実装する。
メンバー変更・スケジュール操作・投票・経費に関するイベントをリアルタイムにユーザーへ届ける。

## 通知対象イベント

| イベント種別 | 受信者 |
|-------------|--------|
| `member_added` | 追加されたユーザー |
| `member_removed` | 削除されたユーザー |
| `role_changed` | ロールが変更されたユーザー |
| `schedule_created` | 自分以外の旅行メンバー全員 |
| `schedule_updated` | 自分以外の旅行メンバー全員 |
| `schedule_deleted` | 自分以外の旅行メンバー全員 |
| `poll_started` | 旅行メンバー全員 |
| `poll_closed` | 旅行メンバー全員 |
| `expense_added` | 割り勘対象に含まれるユーザー |

## DB スキーマ

### `notifications` テーブル

```sql
id         uuid        PRIMARY KEY
user_id    uuid        REFERENCES users(id) ON DELETE CASCADE
trip_id    uuid        REFERENCES trips(id) ON DELETE CASCADE (nullable)
type       enum        通知種別
payload    jsonb       通知文生成に必要な最小データ (actorName, tripName 等)
read_at    timestamp   既読時刻 (null = 未読)
created_at timestamp   DEFAULT now()
```

### `push_subscriptions` テーブル

デバイスごとに複数保持する（マルチデバイス対応）。

```sql
id         uuid  PRIMARY KEY
user_id    uuid  REFERENCES users(id) ON DELETE CASCADE
endpoint   text  NOT NULL
p256dh     text  NOT NULL
auth       text  NOT NULL
created_at timestamp DEFAULT now()
```

### `notification_preferences` テーブル

ユーザーが通知種別ごとに in_app / push を ON/OFF できる。
レコードが存在しない場合はデフォルト（両方 true）とみなす。

```sql
user_id  uuid    REFERENCES users(id) ON DELETE CASCADE \
type     enum                                            } PRIMARY KEY
in_app   boolean DEFAULT true
push     boolean DEFAULT true
```

### 通知種別 enum

```sql
CREATE TYPE notification_type AS ENUM (
  'member_added',
  'member_removed',
  'role_changed',
  'schedule_created',
  'schedule_updated',
  'schedule_deleted',
  'poll_started',
  'poll_closed',
  'expense_added'
);
```

## バックエンド設計

### 実装アプローチ

API ルートハンドラー内で DB 操作の後に通知ユーティリティを呼ぶ（Approach A）。
Supabase Edge Function 等の追加インフラは使わない。

### 通知ユーティリティ (`apps/api/src/lib/notifications.ts`)

```typescript
createNotification(db, {
  type: "member_added",
  userId: string,       // 受信者
  tripId: string | null,
  payload: Record<string, string>,
}): Promise<void>
```

内部処理:
1. `notification_preferences` を確認（レコードなし = デフォルト ON）
2. `in_app` が有効なら `notifications` に INSERT
3. `push` が有効なら `push_subscriptions` を全件取得 → `web-push` で送信
4. push 送信は fire-and-forget（`void` キャスト）でレスポンスをブロックしない

### 新規 API ルート (`apps/api/src/routes/notifications.ts`)

| メソッド | パス | 内容 |
|----------|------|------|
| GET | `/api/notifications` | 一覧取得（カーソルページネーション）+ 未読件数 |
| PUT | `/api/notifications/read-all` | 全件既読 |
| PUT | `/api/notifications/:id/read` | 1件既読 |
| GET | `/api/notification-preferences` | 設定取得 |
| PUT | `/api/notification-preferences` | 設定更新（部分更新可） |
| POST | `/api/push-subscriptions` | push 購読情報を保存 |
| DELETE | `/api/push-subscriptions` | push 購読情報を削除（ログアウト時） |

### 既存ルートへの追記

各ルートの DB 操作後に `createNotification()` を追加する:

| ファイル | 追加する通知種別 |
|----------|----------------|
| `members.ts` | member_added / member_removed / role_changed |
| `schedules.ts` | schedule_created / schedule_updated / schedule_deleted |
| `polls.ts` | poll_started / poll_closed |
| `expenses.ts` | expense_added（split 対象ユーザーのみ） |

## フロントエンド設計

### Service Worker (`apps/web/public/sw.js`)

push イベントを受け取り、OS ネイティブ通知を表示する。
通知クリックで対象旅行ページへ遷移する。

### ヘッダーベルアイコン

- 未読件数バッジを表示
- クリックで通知一覧パネルを開く
- Supabase Realtime で `notifications` テーブルを購読し、リアルタイムに未読数を更新

### 通知一覧パネル

- 最新20件を表示（スクロールで追加取得）
- 各通知クリック → 該当ページへ遷移 + 既読化
- 「すべて既読」ボタン

### Push 購読登録フロー

1. ログイン後の初回アクセス時にブラウザの通知許可ダイアログを表示
2. 許可された場合、`/api/push-subscriptions` に endpoint を保存
3. ログアウト時に購読を削除（`/api/push-subscriptions` DELETE）

### 通知設定 UI

`/settings` ページに「通知設定」セクションを追加。
通知種別ごとに アプリ内 / Push をトグルで設定できる。

## 環境変数

```
VAPID_PUBLIC_KEY=   # web-push の公開鍵
VAPID_PRIVATE_KEY=  # web-push の秘密鍵
VAPID_SUBJECT=      # mailto:xxx または https://xxx
```

`web-push` で生成: `npx web-push generate-vapid-keys`

## スコープ外

- メール通知
- 出発リマインダー（cron が必要）
- お土産・リアクションへの通知
