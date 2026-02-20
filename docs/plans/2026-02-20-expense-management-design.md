# 費用管理機能 設計ドキュメント

## 概要

旅行メンバー間の割り勘・精算機能。費用を記録し、「誰が誰にいくら払うか」を自動計算する。

## 要件

- 費用はスケジュールと紐付けず独立記録
- 分担方法: 均等分割（対象メンバー選択可）+ カスタム金額指定
- 通貨: JPY のみ（整数）
- 精算は計算結果の表示のみ（支払い済みの追跡なし）
- UI: 旅行詳細ページの右パネルに4つ目のタブとして追加

## データモデル

### `expenses` テーブル

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | |
| `tripId` | uuid FK -> trips (cascade) | |
| `paidByUserId` | uuid FK -> users (cascade) | 立替者 |
| `title` | varchar(200) NOT NULL | 費用名 |
| `amount` | integer NOT NULL | 金額（円） |
| `splitType` | enum: `equal` / `custom` | 分割方法 |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `expense_splits` テーブル

| Column | Type | Description |
|--------|------|-------------|
| `expenseId` | uuid FK -> expenses (cascade) | |
| `userId` | uuid FK -> users (cascade) | 負担者 |
| `amount` | integer NOT NULL | 負担額（円） |
| PK | (expenseId, userId) | 複合主キー |

- `equal`: 対象メンバーで均等分割した額を保存（端数は先頭メンバーに加算）
- `custom`: ユーザー指定額をそのまま保存

## API

全エンドポイントは `requireTripAccess` で保護。viewer は GET のみ、editor 以上が CUD 可能。

### `GET /api/trips/:tripId/expenses`

費用一覧と精算サマリを返す。

```typescript
{
  expenses: [
    {
      id: string
      title: string
      amount: number
      splitType: "equal" | "custom"
      paidBy: { id: string; name: string }
      splits: [{ userId: string; name: string; amount: number }]
      createdAt: string
    }
  ]
  settlement: {
    totalAmount: number
    balances: [{ userId: string; name: string; net: number }]
    transfers: [{ from: { id: string; name: string }; to: { id: string; name: string }; amount: number }]
  }
}
```

### `POST /api/trips/:tripId/expenses`

```typescript
// Request
{
  title: string          // 1-200文字
  amount: number         // 1以上の整数
  paidByUserId: string   // trip_members に含まれるユーザー
  splitType: "equal" | "custom"
  splits: [
    { userId: string; amount?: number }  // equal: amount省略可、custom: amount必須
  ]
}
```

バリデーション:
- `splits` の全 userId は trip_members に含まれること
- `custom` の場合、splits の amount 合計 === expense の amount
- `equal` の場合、API 側で均等分割を計算して保存

### `PATCH /api/trips/:tripId/expenses/:expenseId`

POST と同じボディ（全フィールド任意）。splits を送った場合は全置換。

### `DELETE /api/trips/:tripId/expenses/:expenseId`

204 No Content。

## 精算アルゴリズム

1. 各メンバーの `net = 立替合計 - 負担合計` を算出
2. `net > 0` を債権者、`net < 0` を債務者として分離
3. 最大債務者から最大債権者へ、min(|債務|, 債権) を移転
4. 残高が 0 になったメンバーを除外し、繰り返し
5. 送金回数を最小化した transfers リストを返す

## フロントエンド

### UI 配置

右パネルのタブに「費用」を追加（候補 / ブックマーク / 履歴 / 費用）。
モバイルでは既存の MobileCandidateDialog 内に同様に表示。

### 費用タブの構成

**上部: 精算サマリ**
- 合計金額
- 精算が必要な送金リスト（A -> B: ¥2,500）
- 費用がない場合は空状態メッセージ

**下部: 費用一覧**
- カード形式のリスト（タイトル、金額、支払者、分担方法）
- カードタップで編集ダイアログ
- スクロール可能

**フッター: 追加ボタン**
- 「+ 費用を追加」ボタン（editor 以上のみ表示）

### 費用登録/編集ダイアログ

- タイトル（テキスト入力）
- 金額（数値入力、円）
- 支払者（メンバーのドロップダウン）
- 分担方法（ラジオ: 均等 / カスタム）
- 対象メンバー（チェックボックス、均等時）
- カスタム金額入力（カスタム時、合計の一致バリデーション）

## Zod スキーマ

`packages/shared/src/schemas/expense.ts` に配置:
- `createExpenseSchema`
- `updateExpenseSchema`
- `expenseResponseSchema`

## 制限

| Resource | Limit |
|----------|-------|
| Expenses per trip | 200 |

`packages/shared/src/limits.ts` に追加。

## 操作履歴（Activity Log）

既存の `logActivity` を使い、費用の操作を `activity_logs` に記録する。
`entityType` は `"expense"` を使用。

| 操作 | action | entityName | detail |
|------|--------|------------|--------|
| 費用登録 | `created` | タイトル | `¥3,000` |
| 費用更新 | `updated` | タイトル | `¥3,000 → ¥3,500` |
| 費用削除 | `deleted` | タイトル | `¥3,000` |

これにより右パネルの「履歴」タブで費用の変更履歴も確認できる。

## 権限

既存の trip_members ロールに準拠:
- **owner / editor**: 費用の CRUD
- **viewer**: 閲覧のみ
