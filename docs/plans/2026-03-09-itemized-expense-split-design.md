# アイテム別分割モード設計

## 背景

旅行中の費用精算で、居酒屋（共有料理 + 個別ドリンク）やまとめ買い（共有 + 個人物）のように品目ごとに対象者が異なるケースが頻発する。現在の「均等」「カスタム」だけでは外部の電卓で計算してからカスタム入力する必要がある。

## 設計方針

- 分担方法に「アイテム別」タブを追加（均等 / カスタム / アイテム別の3モード）
- 品目データはフロントエンド計算用。API に送るのは最終的な splits（userId + amount）のみ
- DB スキーマ変更は `expenseSplitTypeEnum` に `"itemized"` を追加するだけ
- 既存の均等 / カスタムのフローには影響しない

## UIフロー

1. タイトル・合計金額・支払者を入力（現在と同じ）
2. 分担方法で「アイテム別」タブを選択
3. 品目を追加（複数可）:
   - 品目名（任意、プレースホルダー: "料理"、"ドリンク" など）
   - 金額（必須、正の整数）
   - 対象メンバー（横並び名前ボタンをタップでトグル、デフォルト全員選択）
   - 品目内は選択メンバーで均等割り
4. フッターエリアにリアルタイムで表示:
   - 品目合計 / 合計金額（差分も表示）
   - 「残りを均等割り」ボタン（差分 > 0 の時のみ有効）
   - 各メンバーの負担額サマリー
5. 品目合計 = 合計金額で送信可能（「残りを均等割り」適用後含む）

### 「残りを均等割り」の動作

- 合計金額 - 品目合計の差分を全メンバーに均等配分する品目を自動追加
- 品目名: "その他"（固定）
- 対象: 全メンバー（変更可能）
- 品目を追加/変更すると自動更新される
- ユーザーが手動で削除可能（再度ボタンを押して復活も可能）

## データモデル

### DB スキーマ変更

```sql
ALTER TYPE expense_split_type ADD VALUE 'itemized';
```

Drizzle: `expenseSplitTypeEnum` に `"itemized"` を追加。

### API リクエスト/レスポンス

変更なし。`splitType: "itemized"` の場合も `splitType: "custom"` と同じリクエスト形式:

```json
{
  "title": "居酒屋",
  "amount": 15000,
  "paidByUserId": "...",
  "splitType": "itemized",
  "splits": [
    { "userId": "A", "amount": 5500 },
    { "userId": "B", "amount": 4750 },
    { "userId": "C", "amount": 4750 }
  ]
}
```

品目データは送信しない。フロントエンドで品目 → splits に変換して送信する。

### Zod スキーマ変更

`expenseSplitTypeSchema` に `"itemized"` を追加。バリデーションは `"custom"` と同じルール（全 split に amount 必須、合計一致）を適用。

### API ルート変更

`expenses.ts` の create/update で `splitType === "itemized"` を `"custom"` と同じブランチで処理:

```typescript
const splitAmounts =
  splitType === "equal"
    ? calculateEqualSplit(amount, splits.length)
    : splits.map((s) => s.amount ?? 0);
```

既存コードで `"custom"` 以外は else ブランチに入るため、`"itemized"` は自動的に正しく処理される。変更不要。

## 端数処理

品目内の均等割り: `calculateEqualSplit` と同じロジック。余りを先頭メンバーから1円ずつ配分。

例: 料理 2980円 を 3人で割る → [994, 993, 993]

各メンバーの最終負担額: 全品目の負担額を合算。

## ExpenseDialog の内部ステート

```typescript
type ExpenseItem = {
  id: string;           // nanoid for React key
  name: string;         // optional display name
  amount: string;       // string for input control
  memberIds: Set<string>; // selected members for this item
};

const [items, setItems] = useState<ExpenseItem[]>([]);
const [splitTheRest, setSplitTheRest] = useState(false);
```

## 表示モード

ExpensePanel のリスト表示で `splitType: "itemized"` は `splitType: "custom"` と同じ表示（内訳展開で各メンバーの負担額を表示）。品目の内訳はフロントエンドのみで保持するため、保存後は復元不可。「アイテム別」ラベルだけ区別して表示する。

## バリデーション

- 品目が1つ以上
- 各品目の金額 > 0
- 各品目に対象メンバー1人以上
- 品目合計 = 合計金額（「残りを均等割り」適用後）
- 品目合計 > 合計金額は不可

## テスト

- `expenseSplitTypeSchema` の `"itemized"` 追加テスト
- フロントエンド: 品目 → splits 変換ロジックのユニットテスト（端数処理含む）
- API: `splitType: "itemized"` での create/update の結合テスト
- E2E: アイテム別分割の作成フローテスト
