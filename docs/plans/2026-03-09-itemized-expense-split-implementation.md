# アイテム別費用分割 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 費用の分担方法に「アイテム別」モードを追加し、品目ごとに対象メンバーを選択して割り勘計算を完結させる。

**Architecture:** DB スキーマの enum に `"itemized"` を追加。API は `"custom"` と同じブランチで処理するため変更最小。フロントエンドで品目 → splits 変換ロジックを新規追加し、ExpenseDialog 内に品目入力UIを構築する。

**Tech Stack:** Drizzle ORM (PostgreSQL enum), Zod, React, Tailwind CSS, shadcn/ui, Vitest

**設計ドキュメント:** `docs/plans/2026-03-09-itemized-expense-split-design.md`

---

### Task 1: Zod スキーマに `"itemized"` を追加

**Files:**
- Modify: `packages/shared/src/schemas/expense.ts`
- Test: `apps/api/src/__tests__/expenses.test.ts` (既存テストがパスすることを確認)

**Step 1: `expenseSplitTypeSchema` に `"itemized"` を追加**

```typescript
// packages/shared/src/schemas/expense.ts:5
export const expenseSplitTypeSchema = z.enum(["equal", "custom", "itemized"]);
```

**Step 2: バリデーション refine を更新 — `"itemized"` を `"custom"` と同じルールで処理**

`createExpenseSchema` と `updateExpenseSchema` の custom チェック条件に `"itemized"` を追加:

```typescript
// createExpenseSchema 内の2つの refine:
// (1) "Custom splits require amount for each member"
(data) => {
  if (data.splitType === "custom" || data.splitType === "itemized") {
    return data.splits.every((s) => s.amount !== undefined);
  }
  return true;
},

// (2) "Split amounts must equal total amount"
(data) => {
  if (data.splitType === "custom" || data.splitType === "itemized") {
    const total = data.splits.reduce((sum, s) => sum + (s.amount ?? 0), 0);
    return total === data.amount;
  }
  return true;
},
```

`updateExpenseSchema` にも同じ変更を適用（2箇所）。

**Step 3: テスト実行**

```bash
bun run --filter @sugara/api test
bun run --filter @sugara/shared check-types
```

**Step 4: コミット**

```
feat: Zodスキーマに itemized 分割タイプを追加
```

---

### Task 2: DB スキーマの enum に `"itemized"` を追加

**Files:**
- Modify: `apps/api/src/db/schema.ts`
- Create: migration file (via `bun run db:generate`)

**Step 1: `expenseSplitTypeEnum` に `"itemized"` を追加**

```typescript
// apps/api/src/db/schema.ts:68
export const expenseSplitTypeEnum = pgEnum("expense_split_type", ["equal", "custom", "itemized"]);
```

**Step 2: マイグレーション生成と適用**

```bash
bun run db:generate
bun run db:migrate
```

生成される SQL は `ALTER TYPE expense_split_type ADD VALUE 'itemized';` 相当。

**Step 3: 型チェック**

```bash
bun run check-types
```

**Step 4: コミット**

```
feat: DBスキーマに itemized 分割タイプのenumを追加
```

---

### Task 3: 品目 → splits 変換ロジック（純粋関数）

**Files:**
- Create: `apps/web/lib/expense-calc.ts`
- Create: `apps/web/lib/__tests__/expense-calc.test.ts`

**Step 1: テストを書く**

```typescript
// apps/web/lib/__tests__/expense-calc.test.ts
import { describe, expect, it } from "vitest";
import {
  calculateItemizedSplits,
  type ExpenseLineItem,
} from "../expense-calc";

describe("calculateItemizedSplits", () => {
  const memberA = "00000000-0000-0000-0000-000000000001";
  const memberB = "00000000-0000-0000-0000-000000000002";
  const memberC = "00000000-0000-0000-0000-000000000003";

  it("splits a single item equally among all members", () => {
    const items: ExpenseLineItem[] = [
      { id: "1", name: "料理", amount: 3000, memberIds: new Set([memberA, memberB, memberC]) },
    ];
    const result = calculateItemizedSplits(items, 3000);
    expect(result).toEqual([
      { userId: memberA, amount: 1000 },
      { userId: memberB, amount: 1000 },
      { userId: memberC, amount: 1000 },
    ]);
  });

  it("handles remainder distribution (1 yen to first members)", () => {
    const items: ExpenseLineItem[] = [
      { id: "1", name: "料理", amount: 1000, memberIds: new Set([memberA, memberB, memberC]) },
    ];
    const result = calculateItemizedSplits(items, 1000);
    expect(result).toEqual([
      { userId: memberA, amount: 334 },
      { userId: memberB, amount: 333 },
      { userId: memberC, amount: 333 },
    ]);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(1000);
  });

  it("splits multiple items with different members", () => {
    const items: ExpenseLineItem[] = [
      { id: "1", name: "料理", amount: 3000, memberIds: new Set([memberA, memberB, memberC]) },
      { id: "2", name: "ビール", amount: 1500, memberIds: new Set([memberA, memberB]) },
      { id: "3", name: "ソフトドリンク", amount: 500, memberIds: new Set([memberC]) },
    ];
    // 料理: A=1000, B=1000, C=1000
    // ビール: A=750, B=750
    // ソフトドリンク: C=500
    const result = calculateItemizedSplits(items, 5000);
    const map = new Map(result.map((r) => [r.userId, r.amount]));
    expect(map.get(memberA)).toBe(1750);
    expect(map.get(memberB)).toBe(1750);
    expect(map.get(memberC)).toBe(1500);
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(5000);
  });

  it("includes split-the-rest item", () => {
    const items: ExpenseLineItem[] = [
      { id: "1", name: "ビール", amount: 1000, memberIds: new Set([memberA]) },
      { id: "rest", name: "その他", amount: 4000, memberIds: new Set([memberA, memberB]) },
    ];
    const result = calculateItemizedSplits(items, 5000);
    const map = new Map(result.map((r) => [r.userId, r.amount]));
    expect(map.get(memberA)).toBe(3000); // 1000 + 2000
    expect(map.get(memberB)).toBe(2000);
  });

  it("returns empty array for empty items", () => {
    expect(calculateItemizedSplits([], 0)).toEqual([]);
  });

  it("handles total amount adjustment when item sum differs", () => {
    // Items sum to 4000, totalAmount is 5000
    // The function trusts items and does not auto-adjust
    const items: ExpenseLineItem[] = [
      { id: "1", name: "料理", amount: 4000, memberIds: new Set([memberA, memberB]) },
    ];
    const result = calculateItemizedSplits(items, 5000);
    // Should split based on items, not totalAmount
    expect(result.reduce((s, r) => s + r.amount, 0)).toBe(4000);
  });
});
```

**Step 2: テスト失敗を確認**

```bash
bun run --filter @sugara/web test -- expense-calc
```

**Step 3: 実装**

```typescript
// apps/web/lib/expense-calc.ts
export type ExpenseLineItem = {
  id: string;
  name: string;
  amount: number;
  memberIds: Set<string>;
};

/**
 * Convert line items into per-member split amounts.
 * Each item's amount is divided equally among its memberIds,
 * with remainder distributed to first members (1 yen each).
 */
export function calculateItemizedSplits(
  items: ExpenseLineItem[],
  _totalAmount: number,
): { userId: string; amount: number }[] {
  const memberTotals = new Map<string, number>();

  for (const item of items) {
    const members = Array.from(item.memberIds);
    if (members.length === 0 || item.amount <= 0) continue;

    const base = Math.floor(item.amount / members.length);
    const remainder = item.amount - base * members.length;

    for (let i = 0; i < members.length; i++) {
      const share = i < remainder ? base + 1 : base;
      memberTotals.set(members[i], (memberTotals.get(members[i]) ?? 0) + share);
    }
  }

  return Array.from(memberTotals.entries())
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}
```

**Step 4: テスト通過を確認**

```bash
bun run --filter @sugara/web test -- expense-calc
```

**Step 5: コミット**

```
feat: アイテム別分割の計算ロジックを追加
```

---

### Task 4: ExpenseDialog にアイテム別タブを追加

**Files:**
- Modify: `apps/web/components/expense-dialog.tsx`

**Step 1: import と型定義を追加**

```typescript
// expense-dialog.tsx の先頭
import { Trash2 } from "lucide-react"; // 既存の import に追加
import { calculateItemizedSplits, type ExpenseLineItem } from "@/lib/expense-calc";
```

**Step 2: ステート追加（既存の useState 群の後に追加）**

```typescript
const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
const [splitTheRest, setSplitTheRest] = useState(false);
```

**Step 3: フォームリセット effect を更新**

既存の `useEffect` の else ブランチ（新規作成時）に `setLineItems([])` と `setSplitTheRest(false)` を追加。
edit ブランチでは `splitType === "itemized"` の場合も `"custom"` として読み込む（品目データは保存されないため）。

```typescript
// Reset form when dialog opens
useEffect(() => {
  if (!open) return;
  if (expense) {
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setPaidByUserId(expense.paidByUserId);
    // itemized expenses are loaded as custom (item data not persisted)
    setSplitType(expense.splitType === "itemized" ? "custom" : expense.splitType);
    setSelectedMembers(new Set(expense.splits.map((s) => s.userId)));
    const amounts: Record<string, string> = {};
    for (const s of expense.splits) {
      amounts[s.userId] = String(s.amount);
    }
    setCustomAmounts(amounts);
    setLineItems([]);
    setSplitTheRest(false);
  } else {
    setTitle("");
    setAmount("");
    setPaidByUserId("");
    setSplitType("equal");
    setSelectedMembers(new Set());
    setCustomAmounts({});
    setLineItems([]);
    setSplitTheRest(false);
  }
}, [open, expense]);
```

**Step 4: アイテム別計算の derived state を追加**

```typescript
// Itemized split calculations
const allMemberIds = new Set(members.map((m) => m.userId));
const itemsTotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
const restAmount = parsedAmount - itemsTotal;

const effectiveItems = splitTheRest && restAmount > 0
  ? [...lineItems, { id: "__rest__", name: "その他", amount: restAmount, memberIds: allMemberIds }]
  : lineItems;

const itemizedSplits = splitType === "itemized"
  ? calculateItemizedSplits(
      effectiveItems.map((item) => ({ ...item, amount: Number(item.amount) || 0 })),
      parsedAmount,
    )
  : [];

const itemizedTotal = itemizedSplits.reduce((sum, s) => sum + s.amount, 0);
const itemizedMismatch = splitType === "itemized" && itemizedTotal !== parsedAmount;
```

**Step 5: 品目操作関数を追加**

```typescript
const addLineItem = useCallback(() => {
  setLineItems((prev) => [
    ...prev,
    { id: crypto.randomUUID(), name: "", amount: 0, memberIds: new Set(allMemberIds) },
  ]);
}, [allMemberIds]);

const removeLineItem = useCallback((id: string) => {
  setLineItems((prev) => prev.filter((item) => item.id !== id));
}, []);

const updateLineItem = useCallback((id: string, updates: Partial<Pick<ExpenseLineItem, "name" | "amount">>) => {
  setLineItems((prev) =>
    prev.map((item) =>
      item.id === id ? { ...item, ...updates } : item,
    ),
  );
}, []);

const toggleLineItemMember = useCallback((itemId: string, userId: string) => {
  setLineItems((prev) =>
    prev.map((item) => {
      if (item.id !== itemId) return item;
      const next = new Set(item.memberIds);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return { ...item, memberIds: next };
    }),
  );
}, []);
```

**Step 6: handleSubmit を更新**

`splitType === "itemized"` の場合は `itemizedSplits` を使って splits を送信:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (parsedAmount <= 0 || !paidByUserId) return;

  let splits: { userId: string; amount?: number }[];

  if (splitType === "itemized") {
    splits = itemizedSplits;
  } else if (splitType === "custom") {
    if (selectedMembers.size === 0) return;
    splits = Array.from(selectedMembers).map((userId) => ({
      userId,
      amount: Number(customAmounts[userId]) || 0,
    }));
  } else {
    if (selectedMembers.size === 0) return;
    splits = Array.from(selectedMembers).map((userId) => ({ userId }));
  }

  // ... rest unchanged
};
```

**Step 7: タブUIを3タブに拡張**

```tsx
<Tabs value={splitType} onValueChange={(v) => setSplitType(v as ExpenseSplitType)}>
  <TabsList className="w-full">
    <TabsTrigger value="equal" className="flex-1">均等</TabsTrigger>
    <TabsTrigger value="custom" className="flex-1">カスタム</TabsTrigger>
    <TabsTrigger value="itemized" className="flex-1">アイテム別</TabsTrigger>
  </TabsList>
</Tabs>
```

**Step 8: アイテム別モードのUI実装**

均等/カスタム用の「対象メンバー」セクションの後に、`splitType === "itemized"` 用のセクションを追加:

```tsx
{splitType === "itemized" && (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label asChild><span>品目</span></Label>
      <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
        <Plus className="h-3.5 w-3.5" /> 追加
      </Button>
    </div>

    {lineItems.length === 0 && (
      <p className="text-center text-sm text-muted-foreground py-4">
        品目を追加してください
      </p>
    )}

    {lineItems.map((item) => (
      <div key={item.id} className="space-y-2 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <Input
            value={item.name}
            onChange={(e) => updateLineItem(item.id, { name: e.target.value })}
            placeholder="品目名"
            className="flex-1"
          />
          <Input
            type="number"
            value={item.amount || ""}
            onChange={(e) => updateLineItem(item.id, { amount: Number(e.target.value) || 0 })}
            placeholder="金額"
            className="w-24"
            min={0}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => removeLineItem(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <button
              key={m.userId}
              type="button"
              onClick={() => toggleLineItemMember(item.id, m.userId)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                item.memberIds.has(m.userId)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-accent",
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>
    ))}

    {/* Split the rest */}
    {parsedAmount > 0 && (
      <div className="space-y-2 rounded-md border border-dashed p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {itemsTotal > 0
              ? `品目合計: ${itemsTotal.toLocaleString()}円 / ${parsedAmount.toLocaleString()}円`
              : `合計: ${parsedAmount.toLocaleString()}円`}
          </p>
          {restAmount > 0 && (
            <Button
              type="button"
              variant={splitTheRest ? "secondary" : "outline"}
              size="sm"
              onClick={() => setSplitTheRest((prev) => !prev)}
            >
              {splitTheRest ? `残り ${restAmount.toLocaleString()}円 均等割り中` : `残り ${restAmount.toLocaleString()}円を均等割り`}
            </Button>
          )}
        </div>

        {/* Per-member summary */}
        {itemizedSplits.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-xs text-muted-foreground">負担額</p>
            {itemizedSplits.map((s) => {
              const member = members.find((m) => m.userId === s.userId);
              return (
                <div key={s.userId} className="flex items-center justify-between text-sm">
                  <span>{member?.name ?? s.userId}</span>
                  <span className="font-medium">{s.amount.toLocaleString()}円</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}
  </div>
)}
```

**Step 9: submit ボタンの disabled 条件を更新**

```tsx
disabled={
  loading ||
  !title.trim() ||
  parsedAmount <= 0 ||
  (splitType === "equal" && selectedMembers.size === 0) ||
  (splitType === "custom" && (selectedMembers.size === 0 || customMismatch)) ||
  (splitType === "itemized" && (lineItems.length === 0 || itemizedMismatch))
}
```

**Step 10: 均等/カスタム用セクションを非表示化**

既存の「対象メンバー」セクションを `splitType !== "itemized"` でラップ:

```tsx
{splitType !== "itemized" && (
  <div className="space-y-2">
    <Label asChild><span>対象メンバー</span></Label>
    {/* ... existing member checkboxes and custom amounts ... */}
  </div>
)}
```

**Step 11: 型チェック**

```bash
bun run check-types
bun run check
```

**Step 12: コミット**

```
feat: ExpenseDialogにアイテム別分割UIを追加
```

---

### Task 5: ExpensePanel の表示ラベル更新

**Files:**
- Modify: `apps/web/components/expense-panel.tsx`

**Step 1: splitType 表示を3タイプ対応に変更**

```typescript
// expense-panel.tsx:260 あたり
// 変更前:
{expense.splitType === "equal" ? " / 均等" : " / カスタム"}
// 変更後:
{expense.splitType === "equal" ? " / 均等" : expense.splitType === "itemized" ? " / アイテム別" : " / カスタム"}
```

**Step 2: 型チェック + lint**

```bash
bun run check-types
bun run check
```

**Step 3: コミット**

```
feat: ExpensePanelでアイテム別分割のラベルを表示
```

---

### Task 6: API テストに itemized ケースを追加

**Files:**
- Modify: `apps/api/src/__tests__/expenses.test.ts`

**Step 1: テスト追加**

```typescript
// POST describe 内に追加
it("creates expense with itemized split", async () => {
  const itemizedBody = {
    title: "居酒屋",
    amount: 5000,
    paidByUserId: userId1,
    splitType: "itemized",
    splits: [
      { userId: userId1, amount: 3000 },
      { userId: userId2, amount: 2000 },
    ],
  };
  mockDbQuery.tripMembers.findMany.mockResolvedValue([
    { userId: userId1 },
    { userId: userId2 },
  ]);
  mockCountQuery(0);
  mockDbInsert
    .mockReturnValueOnce({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValueOnce([{ id: "exp-3", ...itemizedBody, createdAt: new Date() }]),
      }),
    })
    .mockReturnValueOnce({
      values: vi.fn().mockResolvedValueOnce(undefined),
    });

  const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(itemizedBody),
  });

  expect(res.status).toBe(201);
});

it("returns 400 when itemized split total does not match amount", async () => {
  const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "居酒屋",
      amount: 5000,
      paidByUserId: userId1,
      splitType: "itemized",
      splits: [
        { userId: userId1, amount: 2000 },
        { userId: userId2, amount: 2000 },
      ],
    }),
  });

  expect(res.status).toBe(400);
});
```

**Step 2: テスト実行**

```bash
bun run --filter @sugara/api test -- expenses
```

**Step 3: コミット**

```
test: アイテム別分割のAPIテストを追加
```

---

### Task 7: FAQ 更新

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`

**Step 1: FAQ エントリを追加/更新**

費用関連の既存 FAQ を確認し、アイテム別分割に関するエントリを追加:

```typescript
{
  question: "居酒屋などで品目ごとに割り勘するにはどうすればいいですか？",
  answer: "費用追加時に分担方法で「アイテム別」を選択してください。品目ごとに金額と対象メンバーを設定できます。個別の飲み物だけ入力して「残りを均等割り」ボタンで共有料理分を自動配分することもできます。",
}
```

**Step 2: ローカル DB に反映**

```bash
bun run --filter @sugara/api db:seed-faqs
```

**Step 3: コミット**

```
docs: アイテム別分割のFAQを追加
```
