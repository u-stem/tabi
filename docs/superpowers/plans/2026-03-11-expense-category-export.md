# Expense Category & CSV Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add expense categories, category-based summaries, and CSV export to the expense management system.

**Architecture:** Extend the existing `expenses` table with a nullable `category` column. Add category totals computation to the GET endpoint response. Add a new CSV export endpoint. Update the expense dialog and panel UI to support category selection and display.

**Tech Stack:** Drizzle ORM (migration), Zod (validation), Hono (API), React (UI), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-11-expense-category-export-design.md`

---

## File Structure

### packages/shared

| File | Action | Responsibility |
|------|--------|----------------|
| `src/schemas/expense.ts` | Modify | Add `expenseCategorySchema` enum, add `category` to create/update schemas |
| `src/types.ts` | Modify | Add `ExpenseCategory` type, `category` to `ExpenseItem`, `CategoryTotal` type, `categoryTotals` to `ExpensesResponse` |
| `src/messages.ts` | Modify | Add `EXPENSE_CATEGORY_LABELS`, add export-related MSG entries |

### apps/api

| File | Action | Responsibility |
|------|--------|----------------|
| `src/db/schema.ts` | Modify | Add `expenseCategoryEnum`, add `category` column to `expenses` |
| `src/routes/expenses.ts` | Modify | Handle `category` in create/update, compute `categoryTotals` in GET, add CSV export endpoint |
| `src/__tests__/expenses.test.ts` | Modify | Add tests for category CRUD and CSV export |
| `src/db/seed-faqs.ts` | Modify | Add FAQ entries for expense categories and CSV export |

### apps/web

| File | Action | Responsibility |
|------|--------|----------------|
| `components/expense-dialog.tsx` | Modify | Add category select field |
| `components/expense-panel.tsx` | Modify | Show category in ExpenseRow, add category totals section, add export button |

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

- [ ] **Step 4: Add MSG entry for expense export failure**

Add to `MSG` object in `messages.ts`, after the existing `EXPENSE_DELETE_FAILED` entry:

```typescript
  EXPENSE_EXPORT_FAILED: "経費のエクスポートに失敗しました",
```

Note: `EXPENSE_DELETE_FAILED` already exists -- do not duplicate it. The existing `EXPORT_FAILED`/`EXPORT_SUCCESS` are for the trip export feature and should not be reused here.

- [ ] **Step 5: Verify types compile**

Run: `bun run --filter @sugara/shared check-types`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas/expense.ts packages/shared/src/types.ts packages/shared/src/messages.ts
git commit -m "feat: 経費カテゴリのスキーマ・型・ラベルを追加"
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
git commit -m "feat: 経費カテゴリの CRUD と集計を実装"
```

---

## Chunk 4: API - CSV Export

### Task 6: Write tests for CSV export endpoint

**Files:**
- Modify: `apps/api/src/__tests__/expenses.test.ts`

- [ ] **Step 1: Add tests for CSV export**

Add a new describe block:

```typescript
  describe("GET /api/trips/:tripId/expenses/export", () => {
    it("returns CSV with BOM and correct headers", async () => {
      mockDbQuery.expenses.findMany.mockResolvedValue([
        {
          id: "exp-1",
          title: "Taxi",
          amount: 2000,
          splitType: "equal",
          category: "transportation",
          paidByUserId: userId1,
          paidByUser: { id: userId1, name: "User 1" },
          splits: [],
          lineItems: [],
          createdAt: "2026-03-10T10:00:00Z",
        },
      ]);

      const res = await makeApp().request(
        `/api/trips/${tripId}/expenses/export?format=csv`,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/csv");
      expect(res.headers.get("content-disposition")).toContain("attachment");

      const text = await res.text();
      // BOM check
      expect(text.charCodeAt(0)).toBe(0xfeff);
      // Header row
      expect(text).toContain("日付,カテゴリ,タイトル,金額,支払者,分担方法");
      // Data row
      expect(text).toContain("交通費");
      expect(text).toContain("Taxi");
      expect(text).toContain("2000");
    });

    it("returns CSV with empty category when not set", async () => {
      mockDbQuery.expenses.findMany.mockResolvedValue([
        {
          id: "exp-2",
          title: "Lunch",
          amount: 1000,
          splitType: "equal",
          category: null,
          paidByUserId: userId1,
          paidByUser: { id: userId1, name: "User 1" },
          splits: [],
          lineItems: [],
          createdAt: "2026-03-10T12:00:00Z",
        },
      ]);

      const res = await makeApp().request(
        `/api/trips/${tripId}/expenses/export?format=csv`,
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      // Category column should be empty
      const lines = text.split("\n");
      const dataLine = lines[1];
      expect(dataLine).toContain(",,Lunch,");
    });

    it("returns empty CSV with only headers when no expenses", async () => {
      mockDbQuery.expenses.findMany.mockResolvedValue([]);

      const res = await makeApp().request(
        `/api/trips/${tripId}/expenses/export?format=csv`,
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      const lines = text.trim().split("\n");
      expect(lines).toHaveLength(1);
    });

    it("allows viewer access", async () => {
      setupAuth("viewer");
      mockDbQuery.expenses.findMany.mockResolvedValue([]);

      const res = await makeApp().request(
        `/api/trips/${tripId}/expenses/export?format=csv`,
      );

      expect(res.status).toBe(200);
    });

    it("escapes CSV fields with commas and quotes", async () => {
      mockDbQuery.expenses.findMany.mockResolvedValue([
        {
          id: "exp-3",
          title: 'Dinner, "special"',
          amount: 3000,
          splitType: "equal",
          category: "meals",
          paidByUserId: userId1,
          paidByUser: { id: userId1, name: "User 1" },
          createdAt: "2026-03-10T18:00:00Z",
        },
      ]);

      const res = await makeApp().request(
        `/api/trips/${tripId}/expenses/export?format=csv`,
      );

      expect(res.status).toBe(200);
      const text = await res.text();
      // Title with comma and quotes should be escaped
      expect(text).toContain('"Dinner, ""special"""');
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/api test -- expenses.test.ts`
Expected: New tests FAIL (export endpoint does not exist yet)

### Task 7: Implement CSV export endpoint

**Files:**
- Modify: `apps/api/src/routes/expenses.ts`

- [ ] **Step 1: Add SPLIT_TYPE_LABELS to messages.ts**

Add to `packages/shared/src/messages.ts`, after `EXPENSE_CATEGORY_LABELS`:

```typescript
import type { ExpenseSplitType } from "./schemas/expense";

export const SPLIT_TYPE_LABELS: Record<ExpenseSplitType, string> = {
  equal: "均等",
  custom: "カスタム",
  itemized: "アイテム別",
};
```

Then import in `apps/api/src/routes/expenses.ts`:

```typescript
import { EXPENSE_CATEGORY_LABELS, SPLIT_TYPE_LABELS } from "@sugara/shared";
```

- [ ] **Step 2: Add helper function for CSV escaping**

Add before the route definitions:

```typescript
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

- [ ] **Step 3: Add export endpoint**

Add after the GET list endpoint (both are read operations; Hono correctly distinguishes `/export` from `/:expenseId`):

```typescript
// Export expenses as CSV
expenseRoutes.get("/:tripId/expenses/export", requireTripAccess(), async (c) => {
  const tripId = c.req.param("tripId");

  // Only fetch paidByUser for CSV -- splits/lineItems are not needed for export
  const expenseList = await db.query.expenses.findMany({
    where: eq(expenses.tripId, tripId),
    with: {
      paidByUser: { columns: { id: true, name: true } },
    },
    orderBy: (expenses, { asc }) => [asc(expenses.createdAt)],
  });

  const BOM = "\uFEFF";
  const header = "日付,カテゴリ,タイトル,金額,支払者,分担方法";

  const rows = expenseList.map((e) => {
    const date = e.createdAt instanceof Date
      ? e.createdAt.toISOString().split("T")[0]
      : String(e.createdAt).split("T")[0];
    const category = e.category
      ? (EXPENSE_CATEGORY_LABELS[e.category as keyof typeof EXPENSE_CATEGORY_LABELS] ?? "")
      : "";
    const title = escapeCsvField(e.title);
    const paidBy = escapeCsvField(e.paidByUser.name);
    const splitType = SPLIT_TYPE_LABELS[e.splitType] ?? e.splitType;

    return `${date},${category},${title},${e.amount},${paidBy},${splitType}`;
  });

  const csv = BOM + [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expenses.csv"`,
    },
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run --filter @sugara/api test -- expenses.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `bun run test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/expenses.ts apps/api/src/__tests__/expenses.test.ts
git commit -m "feat: 経費の CSV エクスポート機能を追加"
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

### Task 9: Update expense panel with category display, totals, and export

**Files:**
- Modify: `apps/web/components/expense-panel.tsx`

- [ ] **Step 1: Add imports**

```typescript
import type { CategoryTotal } from "@sugara/shared";
import { EXPENSE_CATEGORY_LABELS } from "@sugara/shared";
import { Download } from "lucide-react";
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

- [ ] **Step 4: Add export button**

Add export handler function in `ExpensePanel`:

```typescript
  const handleExport = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/expenses/export?format=csv`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "expenses.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(MSG.EXPENSE_EXPORT_FAILED);
    }
  };
```

Update the toolbar section to include the export button (for both mobile and desktop):

```tsx
          {/* Toolbar */}
          <div className="flex justify-end gap-2">
            {expenses.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
                {!isMobile && "エクスポート"}
              </Button>
            )}
            {canEdit && !isMobile && (
              <Button variant="outline" size="sm" onClick={handleAdd}>
                <Plus className="h-4 w-4" />
                費用を追加
              </Button>
            )}
          </div>
```

- [ ] **Step 5: Verify types compile**

Run: `bun run check-types`
Expected: No errors

- [ ] **Step 6: Run lint and format**

Run: `bun run check`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/expense-dialog.tsx apps/web/components/expense-panel.tsx
git commit -m "feat: 経費カテゴリ選択・カテゴリ別集計・CSV エクスポートの UI を追加"
```

---

## Chunk 6: FAQ & Final Verification

### Task 10: Update FAQ

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`

- [ ] **Step 1: Add FAQ entries for expense categories and CSV export**

Add to the `FAQ_ITEMS` array in the Expenses section:

```typescript
  {
    question: "経費にカテゴリを設定できますか？",
    answer: "はい。費用を追加・編集する際に、交通費・宿泊費・食費・通信費・消耗品費・交際費・会議費・その他のカテゴリを設定できます。カテゴリは任意で、設定しなくても費用を記録できます。",
    sortOrder: /* next available in Expenses section */,
  },
  {
    question: "経費をCSVでエクスポートできますか？",
    answer: "はい。費用タブのエクスポートボタンからCSVファイルをダウンロードできます。日付・カテゴリ・タイトル・金額・支払者・分担方法が含まれます。出張の経費精算にご活用ください。",
    sortOrder: /* next available in Expenses section */,
  },
```

- [ ] **Step 2: Seed FAQs**

Run: `bun run --filter @sugara/api db:seed-faqs`
Expected: FAQ items inserted successfully

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/seed-faqs.ts
git commit -m "docs: 経費カテゴリと CSV エクスポートの FAQ を追加"
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
5. Click export button and verify CSV downloads with correct content
6. Edit an expense to change/remove category
