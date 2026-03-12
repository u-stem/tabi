# Expense Category Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expense categories, category-based summaries, and category data in existing trip export to the expense management system.

**Architecture:** Extend the existing `expenses` table with a nullable `category` column. Add category totals computation to the GET endpoint response. Extend the existing trip export (`apps/web/lib/export.ts`) to include category column. Update the expense dialog and panel UI to support category selection and display.

**Tech Stack:** Drizzle ORM (migration), Zod (validation), Hono (API), React (UI), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-11-expense-category-export-design.md`

---

## File Structure

### packages/shared

| File | Action | Responsibility |
|------|--------|----------------|
| `src/schemas/expense.ts` | Modify | Add `expenseCategorySchema` enum, add `category` to create/update schemas |
| `src/types.ts` | Modify | Add `ExpenseCategory` type, `category` to `ExpenseItem`, `CategoryTotal` type, `categoryTotals` to `ExpensesResponse` |
| `src/messages.ts` | Modify | Add `EXPENSE_CATEGORY_LABELS`, `SPLIT_TYPE_LABELS` |

### apps/api

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/schema.ts` | Modify | Add `expenseCategoryEnum`, add `category` column to `expenses` |
| `src/routes/expenses.ts` | Modify | Handle `category` in create/update, compute `categoryTotals` in GET |
| `src/__tests__/expenses.test.ts` | Modify | Add tests for category CRUD and categoryTotals |
| `src/db/seed-faqs.ts` | Modify | Add FAQ entry for expense categories |

### apps/web

| File | Action | Responsibility |
|------|--------|----------------|
| `components/expense-dialog.tsx` | Modify | Add category select field |
| `components/expense-panel.tsx` | Modify | Show category in ExpenseRow, add category totals section |
| `lib/export.ts` | Modify | Add category column to expense export headers/rows, add "itemized" to SPLIT_TYPE_LABELS |
| `app/(authenticated)/trips/[id]/export/page.tsx` | Modify | Pass category in `toExpenseExportData()` |

---

## Chunk 1: Shared Schema & Types

### Task 1: Add expense category schema to shared package

**Files:**
- Modify: `packages/shared/src/schemas/expense.ts`

- [ ] **Step 1: Add expenseCategorySchema to the schema file**

Add after `expenseSplitTypeSchema`:

```typescript
export const expenseCategorySchema = z.enum([
  "transportation",
  "accommodation",
  "meals",
  "communication",
  "supplies",
  "entertainment",
  "conference",
  "other",
]);
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
```

- [ ] **Step 2: Add `category` to `createExpenseSchema`**

Add `category: expenseCategorySchema.optional()` to the object inside `createExpenseSchema`:

```typescript
export const createExpenseSchema = z
  .object({
    title: z.string().min(1).max(EXPENSE_TITLE_MAX_LENGTH),
    amount: z.number().int().min(1),
    paidByUserId: z.string().uuid(),
    splitType: expenseSplitTypeSchema,
    category: expenseCategorySchema.optional(),
    splits: z.array(splitItemSchema).min(1),
    lineItems: z.array(lineItemInputSchema).max(MAX_LINE_ITEMS_PER_EXPENSE).optional(),
  })
  // ... existing refines unchanged
```

- [ ] **Step 3: Add `category` to `updateExpenseSchema`**

Same as above -- `category` is already covered by `.partial()` so just add it to the base object:

```typescript
export const updateExpenseSchema = z
  .object({
    title: z.string().min(1).max(EXPENSE_TITLE_MAX_LENGTH),
    amount: z.number().int().min(1),
    paidByUserId: z.string().uuid(),
    splitType: expenseSplitTypeSchema,
    category: expenseCategorySchema.nullable().optional(),
    splits: z.array(splitItemSchema).min(1),
    lineItems: z.array(lineItemInputSchema).max(MAX_LINE_ITEMS_PER_EXPENSE).optional(),
  })
  .partial()
  // ... existing refines unchanged
```

Note: `nullable().optional()` in update schema allows explicitly clearing category by sending `null`.

- [ ] **Step 4: Verify types compile**

Run: `bun run --filter @sugara/shared check-types`
Expected: No errors

### Task 2: Add types and labels

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/messages.ts`

- [ ] **Step 1: Update ExpenseItem type**

Add `category` field to `ExpenseItem` in `types.ts`:

```typescript
export type ExpenseItem = {
  id: string;
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  category: ExpenseCategory | null;
  paidByUserId: string;
  paidByUser: { id: string; name: string };
  splits: ExpenseSplit[];
  lineItems: ExpenseLineItemResponse[];
  createdAt: string;
};
```

Add import at top of `types.ts`:
```typescript
import type { ExpenseCategory } from "./schemas/expense";
```

- [ ] **Step 2: Add CategoryTotal type and update ExpensesResponse**

Add to `types.ts`:

```typescript
export type CategoryTotal = {
  category: ExpenseCategory;
  label: string;
  total: number;
  count: number;
};

export type ExpensesResponse = {
  expenses: ExpenseItem[];
  settlement: Settlement;
  categoryTotals: CategoryTotal[];
};
```

- [ ] **Step 3: Add EXPENSE_CATEGORY_LABELS to messages.ts**

Add import at top of `messages.ts`:
```typescript
import type { ExpenseCategory } from "./schemas/expense";
```

Add after `SCHEDULE_COLOR_LABELS`:

```typescript
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  transportation: "交通費",
  accommodation: "宿泊費",
  meals: "食費",
  communication: "通信費",
  supplies: "消耗品費",
  entertainment: "交際費",
  conference: "会議費",
  other: "その他",
};
```

- [ ] **Step 4: Add SPLIT_TYPE_LABELS to messages.ts**

Add import and labels for split types (centralizing what was previously local in `export.ts`):

```typescript
import type { ExpenseSplitType } from "./schemas/expense";

export const SPLIT_TYPE_LABELS: Record<ExpenseSplitType, string> = {
  equal: "均等",
  custom: "カスタム",
  itemized: "アイテム別",
};
```

- [ ] **Step 5: Fix existing MSG terminology**

In `messages.ts`, fix the existing `EXPENSE_DELETE_FAILED` to use「費用」instead of「経費」:

```typescript
  EXPENSE_DELETE_FAILED: "費用の削除に失敗しました",
```

- [ ] **Step 6: Verify types compile**

Run: `bun run --filter @sugara/shared check-types`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/schemas/expense.ts packages/shared/src/types.ts packages/shared/src/messages.ts
git commit -m "feat: 費用カテゴリのスキーマ・型・ラベルを追加"
```

---

## Chunk 2: DB Schema & Migration

### Task 3: Add expense_category enum and column to DB schema

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Add expenseCategoryEnum**

Add after `expenseSplitTypeEnum`:

```typescript
export const expenseCategoryEnum = pgEnum("expense_category", [
  "transportation",
  "accommodation",
  "meals",
  "communication",
  "supplies",
  "entertainment",
  "conference",
  "other",
]);
```

- [ ] **Step 2: Add category column to expenses table**

Add `category` field to the `expenses` table definition, after `splitType`:

```typescript
    splitType: expenseSplitTypeEnum("split_type").notNull(),
    category: expenseCategoryEnum("category"),
```

- [ ] **Step 3: Generate migration**

Run: `bun run db:generate`
Expected: A new migration file is created in the migrations directory

- [ ] **Step 4: Apply migration locally**

Run: `bun run db:migrate`
Expected: Migration applied successfully

- [ ] **Step 5: Verify types compile**

Run: `bun run check-types`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat: expenses テーブルに category カラムを追加"
```

---

## Chunk 3: API - Category in CRUD & Category Totals

### Task 4: Write tests for category in expense CRUD

**Files:**
- Modify: `apps/api/src/__tests__/expenses.test.ts`

- [ ] **Step 1: Add test for creating expense with category**

Add to the `POST /api/trips/:tripId/expenses` describe block:

```typescript
    it("creates expense with category", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(0);
      mockDbInsert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValueOnce([
              { id: "exp-cat-1", ...validBody, category: "transportation", createdAt: new Date() },
            ]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, category: "transportation" }),
      });

      expect(res.status).toBe(201);
    });

    it("creates expense without category", async () => {
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1 },
        { userId: userId2 },
      ]);
      mockCountQuery(0);
      mockDbInsert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValueOnce([
              { id: "exp-nocat-1", ...validBody, category: null, createdAt: new Date() },
            ]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockResolvedValueOnce(undefined),
        });

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });

      expect(res.status).toBe(201);
    });

    it("returns 400 for invalid category", async () => {
      const res = await makeApp().request(`/api/trips/${tripId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, category: "invalid_category" }),
      });

      expect(res.status).toBe(400);
    });
```

- [ ] **Step 2: Add test for GET with categoryTotals**

Add to the `GET /api/trips/:tripId/expenses` describe block:

```typescript
    it("returns categoryTotals in response", async () => {
      mockDbQuery.expenses.findMany.mockResolvedValue([
        {
          id: "exp-1",
          title: "Taxi",
          amount: 2000,
          splitType: "equal",
          category: "transportation",
          paidByUserId: userId1,
          paidByUser: { id: userId1, name: "User 1" },
          splits: [{ userId: userId1, amount: 2000, user: { id: userId1, name: "User 1" } }],
          lineItems: [],
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "exp-2",
          title: "Hotel",
          amount: 10000,
          splitType: "equal",
          category: "accommodation",
          paidByUserId: userId1,
          paidByUser: { id: userId1, name: "User 1" },
          splits: [{ userId: userId1, amount: 10000, user: { id: userId1, name: "User 1" } }],
          lineItems: [],
          createdAt: "2026-01-02T00:00:00Z",
        },
        {
          id: "exp-3",
          title: "Lunch",
          amount: 1000,
          splitType: "equal",
          category: null,
          paidByUserId: userId1,
          paidByUser: { id: userId1, name: "User 1" },
          splits: [{ userId: userId1, amount: 1000, user: { id: userId1, name: "User 1" } }],
          lineItems: [],
          createdAt: "2026-01-03T00:00:00Z",
        },
      ]);
      mockDbQuery.tripMembers.findMany.mockResolvedValue([
        { userId: userId1, user: { id: userId1, name: "User 1" } },
      ]);

      const res = await makeApp().request(`/api/trips/${tripId}/expenses`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.categoryTotals).toBeDefined();
      expect(json.categoryTotals).toHaveLength(2);
      expect(json.categoryTotals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ category: "transportation", total: 2000, count: 1 }),
          expect.objectContaining({ category: "accommodation", total: 10000, count: 1 }),
        ]),
      );
    });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- expenses.test.ts`
Expected: New tests FAIL (category not yet handled in API)

### Task 5: Implement category in expense CRUD

**Files:**
- Modify: `apps/api/src/routes/expenses.ts`

- [ ] **Step 1: Handle category in POST endpoint**

In the create expense handler, update the destructuring to include `category`:

```typescript
  const { title, amount, paidByUserId, splitType, splits, lineItems, category } = parsed.data;
```

Update the insert values to include `category`:

```typescript
    const [expense] = await tx
      .insert(expenses)
      .values({ tripId, paidByUserId, title, amount, splitType, category: category ?? null })
      .returning();
```

- [ ] **Step 2: Handle category in PATCH endpoint**

The `category` field is already covered by the spread of `updateFields` (from `parsed.data` minus `splits` and `lineItems`), so no code change is needed for the update handler. Verify this by checking the destructuring:

```typescript
  const { splits, lineItems, ...updateFields } = parsed.data;
  // updateFields will include category if provided
```

- [ ] **Step 3: Compute categoryTotals in GET endpoint**

Add import at top of file:

```typescript
import { EXPENSE_CATEGORY_LABELS } from "@sugara/shared";
```

In the GET handler, after computing `settlement`, add category totals computation:

```typescript
  const categoryMap = new Map<string, { total: number; count: number }>();
  for (const e of expenseList) {
    if (e.category) {
      const existing = categoryMap.get(e.category) ?? { total: 0, count: 0 };
      existing.total += e.amount;
      existing.count += 1;
      categoryMap.set(e.category, existing);
    }
  }

  const categoryTotals = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    label: EXPENSE_CATEGORY_LABELS[category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? category,
    total: data.total,
    count: data.count,
  }));

  return c.json({ expenses: expenseList, settlement, categoryTotals });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @sugara/api test -- expenses.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/expenses.ts apps/api/src/__tests__/expenses.test.ts
git commit -m "feat: 費用カテゴリの CRUD と集計を実装"
```

---

## Chunk 4: Extend Existing Export with Category

The trip export page (`apps/web/app/(authenticated)/trips/[id]/export/page.tsx`) already supports exporting expenses via `apps/web/lib/export.ts`. We extend the existing infrastructure to include the category column.

### Task 6: Add category to existing export infrastructure

**Files:**
- Modify: `apps/web/lib/export.ts`
- Modify: `apps/web/app/(authenticated)/trips/[id]/export/page.tsx`

- [ ] **Step 1: Add category to `ExpenseExportItem` type**

In `apps/web/lib/export.ts`, update the type:

```typescript
export type ExpenseExportItem = {
  title: string;
  amount: number;
  paidByName: string;
  splitType: string;
  category: string | null;
};
```

- [ ] **Step 2: Add category to `EXPENSE_EXPORT_HEADERS`**

```typescript
export const EXPENSE_EXPORT_HEADERS = {
  category: "カテゴリ",
  title: "タイトル",
  amount: "金額",
  paidBy: "支払者",
  splitType: "分担方法",
} as const;
```

- [ ] **Step 3: Replace local `SPLIT_TYPE_LABELS` with shared import**

Remove the local `SPLIT_TYPE_LABELS` definition and import from shared:

```typescript
import { CATEGORY_LABELS, SPLIT_TYPE_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
```

- [ ] **Step 4: Add category column to `buildExpenseRows`**

Update `buildExpenseRows` to include category in the rows. The `blank()` helper and all row constructions need the new column:

```typescript
export function buildExpenseRows(data: ExpenseExportData): Record<string, string | number>[] {
  const H = EXPENSE_EXPORT_HEADERS;
  const blank = (): Record<string, string | number> => ({
    [H.category]: "",
    [H.title]: "",
    [H.amount]: "",
    [H.paidBy]: "",
    [H.splitType]: "",
  });

  const rows: Record<string, string | number>[] = [];

  for (const e of data.expenses) {
    rows.push({
      [H.category]: e.category ?? "",
      [H.title]: e.title,
      [H.amount]: e.amount,
      [H.paidBy]: e.paidByName,
      [H.splitType]: SPLIT_TYPE_LABELS[e.splitType as keyof typeof SPLIT_TYPE_LABELS] ?? e.splitType,
    });
  }

  // Total
  rows.push(blank());
  rows.push({
    [H.category]: "",
    [H.title]: "合計",
    [H.amount]: data.settlement.totalAmount,
    [H.paidBy]: "",
    [H.splitType]: "",
  });

  // Balances
  const nonZeroBalances = data.settlement.balances
    .filter((b) => b.net !== 0)
    .sort((a, b) => b.net - a.net);

  if (nonZeroBalances.length > 0) {
    rows.push(blank());
    rows.push({ [H.category]: "", [H.title]: "[過不足]", [H.amount]: "", [H.paidBy]: "", [H.splitType]: "" });
    for (const b of nonZeroBalances) {
      rows.push({ [H.category]: "", [H.title]: b.name, [H.amount]: b.net, [H.paidBy]: "", [H.splitType]: "" });
    }
  }

  // Transfers
  if (data.settlement.transfers.length > 0) {
    const sorted = [...data.settlement.transfers].sort((a, b) => b.amount - a.amount);
    rows.push(blank());
    rows.push({ [H.category]: "", [H.title]: "[精算]", [H.amount]: "", [H.paidBy]: "", [H.splitType]: "" });
    for (const t of sorted) {
      rows.push({
        [H.category]: "",
        [H.title]: `${t.fromName} → ${t.toName}`,
        [H.amount]: t.amount,
        [H.paidBy]: "",
        [H.splitType]: "",
      });
    }
  }

  return rows;
}
```

- [ ] **Step 5: Update `toExpenseExportData` in export page**

In `apps/web/app/(authenticated)/trips/[id]/export/page.tsx`, add import and update the mapping:

```typescript
import { EXPENSE_CATEGORY_LABELS } from "@sugara/shared";
```

```typescript
function toExpenseExportData(data: ExpensesResponse): ExpenseExportData {
  return {
    expenses: data.expenses.map((e) => ({
      title: e.title,
      amount: e.amount,
      paidByName: e.paidByUser.name,
      splitType: e.splitType,
      category: e.category
        ? (EXPENSE_CATEGORY_LABELS[e.category] ?? null)
        : null,
    })),
    settlement: {
      totalAmount: data.settlement.totalAmount,
      balances: data.settlement.balances.map((b) => ({
        name: b.name,
        net: b.net,
      })),
      transfers: data.settlement.transfers.map((t) => ({
        fromName: t.from.name,
        toName: t.to.name,
        amount: t.amount,
      })),
    },
  };
}
```

- [ ] **Step 6: Verify types compile**

Run: `bun run check-types`
Expected: No errors

- [ ] **Step 7: Run existing export tests**

Run: `bun run test`
Expected: All tests PASS (existing export tests should still work; if any use `ExpenseExportItem`, update them to include `category: null`)

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/export.ts apps/web/app/\(authenticated\)/trips/\[id\]/export/page.tsx
git commit -m "feat: 既存エクスポートに費用カテゴリ列を追加"
```

---

## Chunk 5: Frontend - Expense Dialog & Panel

### Task 8: Add category select to expense dialog

**Files:**
- Modify: `apps/web/components/expense-dialog.tsx`

- [ ] **Step 1: Add category state and imports**

Add import:
```typescript
import type { ExpenseCategory } from "@sugara/shared";
import { EXPENSE_CATEGORY_LABELS } from "@sugara/shared";
```

Add state in the component:
```typescript
  const [category, setCategory] = useState<ExpenseCategory | "">("");
```

- [ ] **Step 2: Initialize category in useEffect**

In the `useEffect` that resets form when dialog opens, add category handling:

For edit mode (inside `if (expense)`):
```typescript
      setCategory(expense.category ?? "");
```

For new mode (inside `else`):
```typescript
      setCategory("");
```

- [ ] **Step 3: Add category select field to form**

Add between the title field and the amount field:

Use `"__none__"` as sentinel value since Radix UI Select does not accept empty string values:

```tsx
          <div className="space-y-2">
            <Label htmlFor="expense-category">カテゴリ</Label>
            <Select
              value={category || "__none__"}
              onValueChange={(v) => setCategory(v === "__none__" ? "" : (v as ExpenseCategory))}
            >
              <SelectTrigger id="expense-category">
                <SelectValue placeholder="未分類" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">未分類</SelectItem>
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```

- [ ] **Step 4: Include category in submit payload**

In `handleSubmit`, update the body:

```typescript
      const body = {
        title,
        amount: parsedAmount,
        paidByUserId,
        splitType,
        splits,
        ...(category ? { category } : {}),
        ...(lineItemsPayload ? { lineItems: lineItemsPayload } : {}),
      };
```

For edit mode, also handle clearing category:
```typescript
      const body = {
        title,
        amount: parsedAmount,
        paidByUserId,
        splitType,
        splits,
        ...(isEdit ? { category: category || null } : category ? { category } : {}),
        ...(lineItemsPayload ? { lineItems: lineItemsPayload } : {}),
      };
```

- [ ] **Step 5: Verify the dialog compiles and works**

Run: `bun run --filter @sugara/web check-types`
Expected: No errors

### Task 9: Update expense panel with category display and totals

**Files:**
- Modify: `apps/web/components/expense-panel.tsx`

- [ ] **Step 1: Add imports**

```typescript
import type { CategoryTotal } from "@sugara/shared";
import { EXPENSE_CATEGORY_LABELS } from "@sugara/shared";
```

- [ ] **Step 2: Show category in ExpenseRow subtitle**

In `ExpenseRow`, update the subtitle to include category:

```tsx
          <p className="text-xs text-muted-foreground">
            {expense.paidByUser.name}が支払い
            {expense.splitType === "equal"
              ? " / 均等"
              : expense.splitType === "itemized"
                ? " / アイテム別"
                : " / カスタム"}
            {expense.category && ` / ${EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}`}
          </p>
```

- [ ] **Step 3: Add category totals section to settlement summary**

In `ExpensePanel`, update the destructuring to include `categoryTotals`:

```typescript
  const { expenses, settlement, categoryTotals } = data ?? {
    expenses: [],
    settlement: { totalAmount: 0, balances: [], transfers: [] },
    categoryTotals: [],
  };
```

Add a category totals section inside the CollapsiblePrimitive.Content, after the settlement transfers section:

```tsx
                  {categoryTotals.length > 0 && (
                    <div className="space-y-1 border-t px-3 pt-2 pb-3">
                      <p className="text-xs text-muted-foreground">カテゴリ別</p>
                      {categoryTotals
                        .sort((a, b) => b.total - a.total)
                        .map((ct) => (
                          <div
                            key={ct.category}
                            className="flex items-center justify-between pl-2 text-sm"
                          >
                            <span className="flex items-center gap-1.5">
                              <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                              {ct.label}
                              <span className="text-xs text-muted-foreground">({ct.count}件)</span>
                            </span>
                            <span className="font-medium">{ct.total.toLocaleString()}円</span>
                          </div>
                        ))}
                    </div>
                  )}
```

- [ ] **Step 4: Verify types compile**

Run: `bun run check-types`
Expected: No errors

- [ ] **Step 6: Run lint and format**

Run: `bun run check`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/expense-dialog.tsx apps/web/components/expense-panel.tsx
git commit -m "feat: 費用カテゴリ選択・カテゴリ別集計の UI を追加"
```

---

## Chunk 6: FAQ & Final Verification

### Task 10: Update FAQ

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`

- [ ] **Step 1: Add FAQ entry for expense categories**

Add to the `FAQ_ITEMS` array in the Expenses section:

```typescript
  {
    question: "費用にカテゴリを設定できますか？",
    answer: "はい。費用を追加・編集する際に、交通費・宿泊費・食費・通信費・消耗品費・交際費・会議費・その他のカテゴリを設定できます。カテゴリは任意で、設定しなくても費用を記録できます。カテゴリ別の集計は精算サマリーに表示され、エクスポートにも含まれます。",
    sortOrder: /* next available in Expenses section */,
  },
```

- [ ] **Step 2: Seed FAQs**

Run: `bun run --filter @sugara/api db:seed-faqs`
Expected: FAQ items inserted successfully

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/seed-faqs.ts
git commit -m "docs: 費用カテゴリの FAQ を追加"
```

### Task 11: Final verification

- [ ] **Step 1: Run full test suite**

Run: `bun run test`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `bun run check-types`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `bun run check`
Expected: No errors

- [ ] **Step 4: Verify dev server starts**

Run: `bun run --filter @sugara/web dev`
Expected: Server starts on localhost:3000 without errors. Manually verify:
1. Open a trip's expense tab
2. Add a new expense with a category selected
3. Verify category shows in expense list
4. Verify category totals appear in settlement summary
5. Open export page, enable expenses, verify category column appears in preview
6. Edit an expense to change/remove category
