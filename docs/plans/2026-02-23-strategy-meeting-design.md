# 作戦会議（一時チャット）機能 設計

## 概要

旅行メンバーが候補登録の前段階でカジュアルにアイデアを出し合うための一時的なチャット機能。
旅行につき同時に1セッションのみ。editor以上のメンバーが開始/終了でき、メッセージはDBに保存される。
手動終了で即削除、放置時は最終メッセージから72時間で自動削除。

## データモデル

```sql
chat_sessions
├── id: UUID (PK)
├── tripId: UUID (FK → trips, UNIQUE)  -- 1旅行1セッション
├── startedBy: UUID (FK → users)
├── createdAt: timestamp
└── lastMessageAt: timestamp           -- 自動削除の判定用

chat_messages
├── id: UUID (PK)
├── sessionId: UUID (FK → chat_sessions, CASCADE)
├── userId: UUID (FK → users)
├── content: text
└── createdAt: timestamp
```

- `chat_sessions.tripId` の UNIQUE 制約で同時1セッションを保証
- セッション削除時に CASCADE でメッセージも消える
- 旅行削除時も trips → chat_sessions → chat_messages と CASCADE で全消去

## API

既存のルートパターン `api/trips/:tripId/` に追加。

```
POST   /api/trips/:tripId/chat/sessions   -- セッション開始
DELETE /api/trips/:tripId/chat/sessions   -- セッション終了（即削除）
GET    /api/trips/:tripId/chat/sessions   -- 現在のセッション取得（存在確認）

GET    /api/trips/:tripId/chat/messages   -- メッセージ一覧（カーソルページネーション）
POST   /api/trips/:tripId/chat/messages   -- メッセージ送信
```

- 全エンドポイントに `requireTripAccess` ミドルウェア適用
- セッション開始/終了/メッセージ送信は editor 以上
- viewer はメッセージ閲覧のみ
- メッセージ送信時に `chat_sessions.lastMessageAt` を更新

## リアルタイム配信

既存の `trip:{tripId}` チャンネルに2つの Broadcast イベントを追加。

- `chat:message` -- 新メッセージ。payload にメッセージ内容を含め、受信側は API を叩かず直接表示
- `chat:session` -- セッション開始/終了通知。受信側はチャットタブの状態を更新

## UI

### 右サイドバー（デスクトップ）

既存タブ（candidates / activity / bookmarks / expenses）に「作戦会議」タブを追加。

**セッションなし時:**
- 「作戦会議を開始」ボタンを表示

**セッションあり時:**
- メッセージ一覧（上から古い順）+ 下部に入力欄
- ユーザー名 + アバター + メッセージ + 時刻のシンプルなバブル表示
- 新メッセージ到着時は自動スクロール
- 入力欄の上に「作戦会議を終了」ボタン（editor 以上に表示）

### モバイル

MobileContentTabs に「作戦会議」タブを追加。レイアウトはデスクトップと同様。

## 自動削除（遅延削除）

専用の cron は設けず、以下のタイミングで期限チェック。

- `GET /chat/sessions` 呼び出し時
- `GET /chat/messages` 呼び出し時
- `POST /chat/messages` 呼び出し時

`lastMessageAt` が72時間超過していればセッション + メッセージを CASCADE 削除し、「セッションなし」として応答。

## アクティビティログ

- セッション開始/終了は `activity_logs` に記録（「作戦会議を開始しました」「作戦会議を終了しました」）
- 個別メッセージはログしない

## スコープ外

- URL / OGP プレビュー
- 画像添付
- メッセージ編集/削除
- 候補へのリンク
- 未読管理/通知バッジ
- メッセージのリアクション
