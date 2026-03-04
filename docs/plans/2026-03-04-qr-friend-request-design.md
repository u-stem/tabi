# QRコードでフレンド申請設計

## 概要

対面でのユーザーID（UUID）コピーが手間なため、QRコードをスキャンするだけでフレンド申請を送れる機能を追加する。

## ユーザーフロー

### QRを提示する側

1. マイページのQRボタンをタップ
2. ダイアログが開き、自分のQRコードを表示
3. 相手のスマホカメラで読み取ってもらう

### QRをスキャンする側

1. カメラアプリで読み取り → ブラウザで `/friends/add?userId=<uuid>` が開く
2. 確認画面: 相手の名前・アイコンを表示
3. 「フレンド申請を送る」ボタンで申請

## アーキテクチャ

### QR生成

- クライアントサイドで `react-qr-code` ライブラリを使用（サーバー不要）
- QRに含むURL: `${process.env.NEXT_PUBLIC_APP_URL}/friends/add?userId=<currentUser.id>`
- ダイアログ形式で表示（shadcn/ui の Dialog を使用）

### スキャン後ページ

新規: `apps/web/app/(authenticated)/friends/add/page.tsx`

- 認証必須（未ログインはログインページへリダイレクト、戻り先URLを保持）
- クエリパラメータ `userId` でユーザー情報を取得
- 既存の `POST /api/friends/requests` を再利用

### 新規APIエンドポイント

`GET /api/users/:userId/profile`

公開プロフィール情報のみを返す最小限のエンドポイント。

**レスポンス**:
```json
{
  "id": "uuid",
  "name": "ユーザー名",
  "image": "https://..." // null可
}
```

**バリデーション**: 認証済みユーザーのみアクセス可（未認証は 401）

## エッジケース

| ケース | 対応 |
|--------|------|
| 自分自身のQRをスキャン | エラーメッセージ「自分自身には申請できません」 |
| 既にフレンド | 「すでにフレンドです」を表示、申請ボタンを無効化 |
| 申請済み（送信済み） | 「申請済みです」を表示、申請ボタンを無効化 |
| 存在しないuserId | 「ユーザーが見つかりません」 |
| 未ログインでアクセス | `/login?redirect=/friends/add?userId=xxx` へリダイレクト |
| フレンド上限（100人） | 既存のエラーレスポンスをそのまま表示 |

## ファイル変更一覧

| 区分 | パス |
|------|------|
| 新規 API route | `apps/api/src/routes/users.ts` |
| 既存変更 | `apps/api/src/index.ts` （usersルートを登録） |
| 新規 Page | `apps/web/app/(authenticated)/friends/add/page.tsx` |
| 新規 Component | `apps/web/components/my-qr-dialog.tsx` |
| 既存変更 | `apps/web/app/(sp)/mypage/page.tsx` （QRボタン追加） |
| 新規 Schema | `packages/shared/src/schemas/user.ts` |
| 既存変更 | `packages/shared/src/index.ts` （エクスポート追加） |

## 依存ライブラリ

- `react-qr-code`: `apps/web` に追加
  - 選定理由: SVGベースで軽量、依存なし、SSR対応

## セキュリティ考慮

- UUID（ユーザーID）がQRに含まれるが、フレンド申請には承認が必要なためリスクは限定的
- 公開プロフィールAPIは認証済みユーザーのみアクセス可（名前・アイコンのみ返す）
- フレンド上限・申請の重複チェックは既存ロジックで対応済み
