# アイテム別費用の品目データ永続化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** アイテム別(itemized)費用の品目データをDBに永続化し、編集時に品目を復元できるようにする

**Architecture:** `expense_line_items` テーブルと `expense_line_item_members` テーブルを追加。費用作成/更新時に品目データをトランザクション内で保存し、取得時にリレーションで読み込む。フロントエンドは編集時に品目データを復元してアイテム別タブを表示する。

**Tech Stack:** Drizzle ORM, PostgreSQL, Zod, Hono, React

---

### Task 1: DB スキーマに品目テーブルを追加

**Files:**
- Modify: `apps/api/src/db/schema.ts` (expenses テーブル付近 ~line 492)

**Step 1: `expenseLineItems` テーブルを定義**

`expenseSplits` テーブル (line 492) の直後に追加:

```typescript
export const expenseLineItems = pgTable(
  "expense_line_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    amount: integer("amount").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("expense_line_items_expense_id_idx").on(table.expenseId)],
).enableRLS();

export const expenseLineItemMembers = pgTable(
  "expense_line_item_members",
  {
    lineItemId: uuid("line_item_id")
      .notNull()
      .references(() => expenseLineItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.lineItemId, table.userId] })],
).enableRLS();
```

**Step 2: リレーションを定義**

`expenseSplitsRelations` (line 631-634) の直後に追加:

```typescript
export const expenseLineItemsRelations = relations(expenseLineItems, ({ one, many }) => ({
  expense: one(expenses, { fields: [expenseLineItems.expenseId], references: [expenses.id] }),
  members: many(expenseLineItemMembers),
}));

export const expenseLineItemMembersRelations = relations(expenseLineItemMembers, ({ one }) => ({
  lineItem: one(expenseLineItems, {
    fields: [expenseLineItemMembers.lineItemId],
    references: [expenseLineItems.id],
  }),
  user: one(users, { fields: [expenseLineItemMembers.userId], references: [users.id] }),
}));
```

`expensesRelations` (line 625-629) に `lineItems` を追加:

```typescript
export const expensesRelations = relations(expenses, ({ one, many }) => ({
  trip: one(trips, { fields: [expenses.tripId], references: [trips.id] }),
  paidByUser: one(users, { fields: [expenses.paidByUserId], references: [users.id] }),
  splits: many(expenseSplits),
  lineItems: many(expenseLineItems),
}));
```

**Step 3: マイグレーション生成・適用**

```bash
bun run db:generate
bun run db:migrate
```

**Step 4: コミット**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat: expense_line_items / expense_line_item_members テーブルを追加"
```

---

### Task 2: 共有スキーマにlineItems型を追加

**Files:**
- Modify: `packages/shared/src/schemas/expense.ts`

**Step 1: lineItemSchema を定義し createExpenseSchema / updateExpenseSchema に追加**

`splitItemSchema` の後に追加:

```typescript
const lineItemInputSchema = z.object({
  name: z.string().min(1).max(200),
  amount: z.number().int().min(1),
  memberIds: z.array(z.string().uuid()).min(1),
});
```

`createExpenseSchema` の `splits` フィールドの後に追加:

```typescript
lineItems: z.array(lineItemInputSchema).optional(),
```

`.refine()` を追加（itemized の場合 lineItems 必須）:

```typescript
.refine(
  (data) => {
    if (data.splitType === "itemized") {
      return data.lineItems !== undefined && data.lineItems.length > 0;
    }
    return true;
  },
  { message: "Itemized split requires line items", path: ["lineItems"] },
)
```

`updateExpenseSchema` にも同様に `lineItems` フィールドと refine を追加。

**Step 2: shared パッケージの型をエクスポート確認**

```bash
bun run --filter @sugara/shared check-types
```

**Step 3: コミット**

```bash
git add packages/shared/
git commit -m "feat: 共有スキーマに lineItems を追加"
```

---

### Task 3: API の費用作成エンドポイントで品目を保存

**Files:**
- Modify: `apps/api/src/routes/expenses.ts`
- Test: `apps/api/src/__tests__/expenses.test.ts`

**Step 1: テストを書く**

既存の itemized テストを拡張し、lineItems が保存されることを確認:

```typescript
it("creates itemized expense with line items", async () => {
  const res = await request(tripId, "/expenses", {
    method: "POST",
    body: {
      title: "居酒屋",
      amount: 5000,
      paidByUserId: ownerUserId,
      splitType: "itemized",
      splits: [
        { userId: ownerUserId, amount: 3000 },
        { userId: memberUserId, amount: 2000 },
      ],
      lineItems: [
        { name: "料理", amount: 3000, memberIds: [ownerUserId, memberUserId] },
        { name: "ビール", amount: 2000, memberIds: [ownerUserId] },
      ],
    },
  });
  expect(res.status).toBe(201);
  // GET で lineItems が返ることを確認
  const getRes = await request(tripId, "/expenses");
  const data = await getRes.json();
  const expense = data.expenses.find((e: any) => e.title === "居酒屋");
  expect(expense.lineItems).toHaveLength(2);
  expect(expense.lineItems[0].members).toBeDefined();
});
```

**Step 2: テスト実行で失敗を確認**

```bash
bun run --filter @sugara/api test
```

**Step 3: expenses.ts の POST ハンドラを修正**

import に `expenseLineItems`, `expenseLineItemMembers` を追加。

トランザクション内で lineItems を保存:

```typescript
// After inserting expenseSplits (line 104)
if (lineItems && lineItems.length > 0) {
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const [lineItem] = await tx
      .insert(expenseLineItems)
      .values({
        expenseId: expense.id,
        name: item.name,
        amount: item.amount,
        sortOrder: i,
      })
      .returning();

    await tx.insert(expenseLineItemMembers).values(
      item.memberIds.map((userId) => ({
        lineItemId: lineItem.id,
        userId,
      })),
    );
  }
}
```

**Step 4: GET ハンドラで lineItems を含めて取得**

`db.query.expenses.findMany` の `with` に追加:

```typescript
lineItems: {
  with: { members: true },
  orderBy: (lineItems, { asc }) => [asc(lineItems.sortOrder)],
},
```

**Step 5: テスト実行で成功を確認**

```bash
bun run --filter @sugara/api test
```

**Step 6: コミット**

```bash
git add apps/api/
git commit -m "feat: 費用作成/取得で品目データを保存・返却"
```

---

### Task 4: API の費用更新エンドポイントで品目を更新

**Files:**
- Modify: `apps/api/src/routes/expenses.ts`
- Test: `apps/api/src/__tests__/expenses.test.ts`

**Step 1: テストを書く**

```typescript
it("updates itemized expense line items", async () => {
  // Create
  const createRes = await request(tripId, "/expenses", {
    method: "POST",
    body: {
      title: "居酒屋",
      amount: 5000,
      paidByUserId: ownerUserId,
      splitType: "itemized",
      splits: [
        { userId: ownerUserId, amount: 3000 },
        { userId: memberUserId, amount: 2000 },
      ],
      lineItems: [
        { name: "料理", amount: 3000, memberIds: [ownerUserId, memberUserId] },
        { name: "ビール", amount: 2000, memberIds: [ownerUserId] },
      ],
    },
  });
  const created = await createRes.json();

  // Update with different line items
  const updateRes = await request(tripId, `/expenses/${created.id}`, {
    method: "PATCH",
    body: {
      title: "居酒屋",
      amount: 6000,
      splitType: "itemized",
      splits: [
        { userId: ownerUserId, amount: 4000 },
        { userId: memberUserId, amount: 2000 },
      ],
      lineItems: [
        { name: "料理", amount: 4000, memberIds: [ownerUserId, memberUserId] },
        { name: "ソフトドリンク", amount: 2000, memberIds: [memberUserId] },
      ],
    },
  });
  expect(updateRes.status).toBe(200);

  // GET で新しい lineItems を確認
  const getRes = await request(tripId, "/expenses");
  const data = await getRes.json();
  const expense = data.expenses.find((e: any) => e.id === created.id);
  expect(expense.lineItems).toHaveLength(2);
  expect(expense.lineItems[0].name).toBe("料理");
  expect(expense.lineItems[1].name).toBe("ソフトドリンク");
});
```

**Step 2: テスト実行で失敗を確認**

```bash
bun run --filter @sugara/api test
```

**Step 3: PATCH ハンドラを修正**

`parsed.data` の分割代入に `lineItems` を追加:

```typescript
const { splits, lineItems, ...updateFields } = parsed.data;
```

トランザクション内、splits 更新の後に:

```typescript
// Delete existing line items (cascade deletes members)
await tx.delete(expenseLineItems).where(eq(expenseLineItems.expenseId, expenseId));

if (lineItems && lineItems.length > 0) {
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    const [lineItem] = await tx
      .insert(expenseLineItems)
      .values({
        expenseId,
        name: item.name,
        amount: item.amount,
        sortOrder: i,
      })
      .returning();

    await tx.insert(expenseLineItemMembers).values(
      item.memberIds.map((userId) => ({
        lineItemId: lineItem.id,
        userId,
      })),
    );
  }
}
```

splitType が itemized 以外に変更された場合も既存品目を削除:

```typescript
if (updateFields.splitType && updateFields.splitType !== "itemized") {
  await tx.delete(expenseLineItems).where(eq(expenseLineItems.expenseId, expenseId));
}
```

**Step 4: テスト実行で成功を確認**

```bash
bun run --filter @sugara/api test
```

**Step 5: コミット**

```bash
git add apps/api/
git commit -m "feat: 費用更新で品目データを差し替え保存"
```

---

### Task 5: フロントエンドで品目データを復元

**Files:**
- Modify: `apps/web/components/expense-dialog.tsx`

**Step 1: Expense 型に lineItems を追加**

```typescript
type Expense = {
  id: string;
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  paidByUserId: string;
  splits: { userId: string; amount: number }[];
  lineItems?: {
    id: string;
    name: string;
    amount: number;
    sortOrder: number;
    members: { userId: string }[];
  }[];
};
```

**Step 2: 編集時の初期化ロジックを修正**

`useEffect` の `if (expense)` ブロック (line 80-94) で、itemized 費用に品目データがある場合はアイテム別タブで表示:

```typescript
if (expense) {
  setTitle(expense.title);
  setAmount(String(expense.amount));
  setPaidByUserId(expense.paidByUserId);

  if (expense.splitType === "itemized" && expense.lineItems && expense.lineItems.length > 0) {
    setSplitType("itemized");
    setLineItems(
      expense.lineItems.map((li) => ({
        id: li.id,
        name: li.name,
        amount: li.amount,
        memberIds: new Set(li.members.map((m) => m.userId)),
      })),
    );
    setSplitTheRest(false);
  } else {
    setSplitType(expense.splitType === "itemized" ? "custom" : expense.splitType);
    setLineItems([]);
    setSplitTheRest(false);
  }

  setSelectedMembers(new Set(expense.splits.map((s) => s.userId)));
  const amounts: Record<string, string> = {};
  for (const s of expense.splits) {
    amounts[s.userId] = String(s.amount);
  }
  setCustomAmounts(amounts);
  setMembersInitialized(true);
}
```

**Step 3: handleSubmit で lineItems をAPIに送信**

```typescript
if (splitType === "itemized") {
  // ...existing splits calculation...
  // Add lineItems to request body
  const lineItemsPayload = lineItems.map((item, i) => ({
    name: item.name,
    amount: Number(item.amount) || 0,
    memberIds: Array.from(item.memberIds),
  }));
  // Include in body: lineItems: lineItemsPayload
}
```

POST/PATCH の body に `lineItems` を含める。itemized 以外では `lineItems` を送信しない。

**Step 4: 動作確認**

- 新規アイテム別費用を作成 → 一覧に反映
- 編集ダイアログを開く → 品目が復元される
- 品目を変更して保存 → 反映される
- アイテム別→カスタムに変更して保存 → 品目が削除される

**Step 5: コミット**

```bash
git add apps/web/
git commit -m "feat: 編集時にアイテム別費用の品目を復元"
```

---

### Task 6: シードデータに lineItems を追加

**Files:**
- Modify: `apps/api/src/db/seed.ts`

**Step 1: 「先斗町 居酒屋」のシードに lineItems を追加**

既存の itemized 費用シードデータの body に `lineItems` フィールドを追加:

```typescript
lineItems: [
  { name: "お通し", amount: 1500, memberIds: [devUserId, aliceUserId, bobUserId] },
  { name: "刺身盛り合わせ", amount: 3500, memberIds: [devUserId, aliceUserId, bobUserId] },
  { name: "日本酒", amount: 5000, memberIds: [devUserId, aliceUserId] },
  { name: "ソフトドリンク", amount: 1000, memberIds: [bobUserId] },
  { name: "デザート", amount: 4000, memberIds: [devUserId, aliceUserId, bobUserId] },
],
```

金額の合計が品目の合計と一致することを確認。

**Step 2: DB リセットして投入**

```bash
supabase db reset && bun run db:migrate && bun run db:seed
```

**Step 3: コミット**

```bash
git add apps/api/src/db/seed.ts
git commit -m "feat: シードデータに品目明細を追加"
```

---

### Task 7: 型チェック・lint・テスト

**Step 1: 全テスト実行**

```bash
bun run test
```

**Step 2: 型チェック・lint**

```bash
bun run check
bun run check-types
```

**Step 3: 問題があれば修正してコミット**
