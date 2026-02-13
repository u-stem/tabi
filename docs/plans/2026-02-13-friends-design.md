# フレンド機能 設計

## 概要

旅行にメンバーを追加する際、UUID を毎回入力する手間を減らすため、フレンド機能を追加する。
フレンド申請 -> 承認のフローを経て相互にフレンドとなり、メンバー追加時に一覧から選択できる。

## 設計方針

- **相互承認型フレンド**: リクエストを送り、相手が承認して初めてフレンドになる
- **識別方法**: ユーザーID (UUID) で相手を特定。設定画面からコピペして使う
- **通知なし**: フレンド管理画面を開いたときにリクエストを確認する。ナビゲーションにバッジ表示
- **独立ページ**: フレンド管理は `/friends` に専用ページを設ける
- **統合型メンバー追加 UI**: メンバー追加ダイアログ内で「フレンドから選ぶ」と「ユーザーIDで追加」を並べる

## データベーススキーマ

`friends` テーブルを追加。

| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | レコード ID |
| requesterId | uuid (FK -> users.id) | 申請した側 |
| addresseeId | uuid (FK -> users.id) | 申請された側 |
| status | enum ("pending", "accepted") | 状態 |
| createdAt | timestamp | 作成日時 |
| updatedAt | timestamp | 更新日時 |

- UNIQUE 制約: (requesterId, addresseeId)
- 双方向の関係を1レコードで管理
- 拒否時はレコード削除（拒否履歴は持たない）

## API

全エンドポイントで `requireAuth` を適用。

### GET /api/friends

フレンド一覧を取得 (status=accepted のみ)。

レスポンス:
```json
[{ "friendId": "レコードuuid", "userId": "相手のuuid", "name": "表示名" }]
```

### GET /api/friends/requests

受信したフレンドリクエスト一覧を取得 (status=pending, addresseeId=自分)。

レスポンス:
```json
[{ "id": "レコードuuid", "requesterId": "uuid", "name": "申請者の表示名", "createdAt": "日時" }]
```

### POST /api/friends/requests

フレンドリクエストを送信。

リクエスト:
```json
{ "addresseeId": "uuid" }
```

バリデーション:
- addresseeId が自分自身でないこと
- addresseeId のユーザーが存在すること
- 既にフレンドまたは申請済みでないこと (双方向チェック)
- フレンド数上限 (MAX_FRIENDS = 100) を超えないこと

### PATCH /api/friends/requests/:id

フレンドリクエストを承認。addressee のみ実行可能。

リクエスト:
```json
{ "status": "accepted" }
```

### DELETE /api/friends/requests/:id

フレンドリクエストを拒否 (addressee) または取り消し (requester)。

### DELETE /api/friends/:friendId

フレンド解除。どちらの側からも実行可能。レコードを削除する。

## フロントエンド

### フレンド管理ページ (/friends)

ナビゲーションに「フレンド」リンクを追加。受信リクエストがある場合はバッジで件数表示。

ページ内のセクション構成:

1. **受信リクエスト** - 未承認リクエストの一覧。承認/拒否ボタン。なければ非表示
2. **フレンド一覧** - 承認済みフレンドの一覧。各項目に解除ボタン
3. **フレンド申請** - ユーザーID 入力フォーム + 申請ボタン

### メンバー追加ダイアログ (member-dialog.tsx)

2つのタブに分ける:

1. **「フレンドから」タブ**
   - フレンド一覧をリスト表示
   - 各項目にロール選択 + 追加ボタン
   - 既にメンバーの人はグレーアウト

2. **「ユーザーIDで追加」タブ**
   - 現状の UUID 入力フォーム
   - 「フレンド申請も送る」チェックボックス (デフォルト ON)
   - ロール選択 + 追加ボタン

## 共有スキーマ (packages/shared)

```typescript
// friends.ts
export const friendRequestSchema = z.object({
  addresseeId: z.string().uuid(),
})

export const acceptFriendRequestSchema = z.object({
  status: z.literal("accepted"),
})

export type FriendResponse = {
  friendId: string
  userId: string
  name: string
}

export type FriendRequestResponse = {
  id: string
  requesterId: string
  name: string
  createdAt: string
}
```
