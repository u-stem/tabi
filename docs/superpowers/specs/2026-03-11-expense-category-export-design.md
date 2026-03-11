# Expense Category & Export Design

## Goal

Add expense categories, category-based summaries, and CSV export to support business trip expense reporting without storing personal information.

## Background

sugara's expense management currently tracks title, amount (integer JPY), split type, and per-member splits. There is no way to categorize expenses or export them for external use (e.g., submitting to a company for reimbursement).

## Approach: Extend existing expenses table

Add a nullable `category` column to the `expenses` table. This approach:
- Preserves backward compatibility (existing expenses have no category)
- Works for both business and leisure trips (category is optional)
- Requires minimal schema changes

**Not chosen:** Separate business_expenses table (code duplication), trip-level mode toggle (limits leisure trips from using categories).

## Data Model

### New enum: `expense_category`

```
transportation   -- Travel expenses (trains, taxis, flights)
accommodation    -- Hotel / lodging
meals            -- Food and drink
communication    -- Phone, Wi-Fi
supplies         -- Office supplies, consumables
entertainment    -- Client entertainment, dinners
conference       -- Meeting expenses
other            -- Miscellaneous
```

Based on Japanese accounting standards (勘定科目) and IRS categories.

### Schema change

```
expenses table:
  + category: expense_category (nullable)
```

Nullable because:
1. Existing data has no category
2. Category is optional for leisure trips

## Features

### 1. Category selection in expense dialog

- Optional select field between title and amount fields
- Shows Japanese labels from EXPENSE_CATEGORY_LABELS
- Default: unselected (null)

### 2. Category display in expense list

- Show category label in ExpenseRow subtitle (when set)
- Format: "{payer}が支払い / {splitType} / {category}"

### 3. Category-based summary

- Add `categoryTotals` to ExpensesResponse
- Computed server-side in GET endpoint (no new DB table)
- Displayed as a collapsible section in the settlement summary

```typescript
type CategoryTotal = {
  category: ExpenseCategory;
  label: string;
  total: number;
  count: number;
};
```

### 4. CSV export

- New API endpoint: `GET /api/trips/:tripId/expenses/export?format=csv`
- UTF-8 with BOM (Excel compatibility)
- Columns: date, category, title, amount, paidBy, splitType
- Category column shows Japanese label (empty if unset)
- Browser-side Blob download triggered by export button in expense panel header

## Out of scope

- PDF export (CSV is sufficient for initial release)
- Multi-currency support (future enhancement)
- Trip-level business/leisure label
- Per diem calculation
- Receipt/image attachment
