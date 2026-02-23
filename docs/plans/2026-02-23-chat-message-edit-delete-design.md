# 作戦会議メッセージ編集・削除 設計

## 概要

作戦会議のチャットに、送信済みメッセージの編集と削除機能を追加する。対象は自分のメッセージのみ。

## データモデル

### DB変更

`chatMessages` テーブルに1カラム追加:

```sql
editedAt: timestamp with timezone (nullable, default null)
```

編集済みかどうかは `editedAt IS NOT NULL` で判定。編集履歴は保持しない。

### 型変更

`ChatMessageResponse` に追加:

```typescript
editedAt?: string  // ISO timestamp, undefined if never edited
```

`updateChatMessageSchema` を新規追加 (`sendChatMessageSchema` と同じバリデーション):

```typescript
updateChatMessageSchema = z.object({
  content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
})
```

## API

### PATCH `/api/trips/:tripId/chat/messages/:messageId`

- 認証: editor+
- 権限: 自分のメッセージのみ (`userId === session.user.id`)
- Body: `{ content: string }`
- レスポンス: `ChatMessageResponse` (200)
- 動作: `content` と `editedAt` を更新

### DELETE `/api/trips/:tripId/chat/messages/:messageId`

- 認証: editor+
- 権限: 自分のメッセージのみ
- レスポンス: 204
- 動作: DBから完全削除

## リアルタイム同期

既存の `chat:message` に加えて:

- `chat:message:edit` — 編集後の `ChatMessageResponse` を送信
- `chat:message:delete` — `{ messageId: string }` を送信

## フロントエンドUI

### 操作のトリガー

- **モバイル**: 自分のメッセージをロングプレス → ActionSheet (「編集」「削除」)
- **デスクトップ**: 自分のメッセージにホバー → メッセージ右上にアクションボタン (鉛筆・ゴミ箱)

### ロングプレス

`useLongPress` カスタムフックを新規作成:

- touchstart/touchend + setTimeout (500ms)
- touchmove でキャンセル (スクロールとの干渉防止)

### 編集モード

1. 「編集」選択 → 入力欄に既存テキストをセット
2. 入力欄の上に「メッセージを編集中 ✕」バーを表示
3. Enter で PATCH 送信、✕ でキャンセル
4. 編集中は `editingMessage: { id, content } | null` で状態管理

### メッセージ表示

- 編集済み: 時刻の横に小さく `(編集済み)` を表示
- 削除: UIから即座に消える

### 削除確認

ResponsiveAlertDialog で確認ダイアログを表示してから削除。

### 楽観的更新

- 編集: `queryClient.setQueryData` でメッセージ内容と `editedAt` を即座に更新
- 削除: `queryClient.setQueryData` でメッセージをリストから即座に除去
- エラー時はロールバック

## 既存パターンの活用

- `ActionSheet` — モバイルのアクション表示 (schedule-item 等で使用済み)
- `useIsMobile` — モバイル/デスクトップ分岐
- `DropdownMenu` — デスクトップのホバーメニュー (schedule-item のパターン)
- `ResponsiveAlertDialog` — 削除確認ダイアログ
