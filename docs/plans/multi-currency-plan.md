# Multi-Currency Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable multi-currency expenses within trips — each trip has a base currency, expenses can be in any of 12 currencies with exchange rate conversion.

**Architecture:** Add currency definitions to shared package, extend DB schema (trips.currency, expenses.currency/exchangeRate/baseAmount), add exchange rate API endpoint with frankfurter.dev integration, update expense CRUD to handle currency conversion, replace all hardcoded ¥ formatting with `Intl.NumberFormat`-based `formatCurrency()`.

**Tech Stack:** Hono (API), Drizzle ORM (DB), Zod (validation), React + shadcn/ui (frontend), Vitest (testing), frankfurter.dev (exchange rates)

**Spec:** `docs/plans/multi-currency.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `packages/shared/src/currency.ts` | Currency definitions (12 currencies), utility functions (toMinorUnits, fromMinorUnits, formatCurrency, convertToBase) |
| `packages/shared/src/currency.test.ts` | Unit tests for currency utilities |
| `apps/api/src/lib/exchange-rate.ts` | frankfurter.dev client with memory cache |
| `apps/api/src/lib/exchange-rate.test.ts` | Unit tests for exchange rate client |
| `apps/api/src/routes/exchange-rate.ts` | GET /api/exchange-rate endpoint |
| `apps/api/src/routes/exchange-rate.test.ts` | Unit tests for exchange rate route |

### Modified files

| File | Change |
|------|--------|
| `packages/shared/src/schemas/expense.ts` | Add currency, exchangeRate to create/update schemas |
| `packages/shared/src/schemas/trip.ts` | Add currency to create/update schemas |
| `packages/shared/src/index.ts` | Re-export currency module |
| `apps/api/src/db/schema.ts` | Add currency columns to trips/expenses tables |
| `apps/api/src/app.ts` | Register exchange-rate route |
| `apps/api/src/routes/expenses.ts` | Handle currency, exchangeRate, baseAmount; pass baseAmount to splits; update categoryTotals; update activity log |
| `apps/api/src/routes/settlement-payments.ts` | Use baseAmount ?? amount; update activity log |
| `apps/api/src/lib/settlement.ts` | No algorithm change — caller passes baseAmount |
| `apps/web/lib/expense-calc.ts` | Accept baseAmount for split calculation |
| `apps/web/components/create-trip-dialog.tsx` | Add currency selector |
| `apps/web/components/edit-trip-dialog.tsx` | Add currency selector (disabled when expenses exist) |
| `apps/web/components/expense-dialog.tsx` | Add currency selector, exchange rate input, base amount display |
| `apps/web/components/expense-panel.tsx` | Replace amountWithCurrency with formatCurrency, show base amount for foreign expenses |
| `apps/web/components/settlement-section.tsx` | Replace amountWithCurrency with formatCurrency using trip currency |
| `apps/web/components/unsettled-summary.tsx` | Replace hardcoded ¥ with formatCurrency |
| `apps/web/messages/ja.json` | Add currency-related i18n keys, remove amountWithCurrency |
| `apps/web/messages/en.json` | Add currency-related i18n keys, remove amountWithCurrency |
| `packages/shared/src/discord-embed.ts` | Update expense_added message to include formatted amount |
| `apps/api/src/db/seed-faqs.ts` | Add FAQ entries |

---

## Task 1: Currency Definitions + Utility Functions

**Files:**
- Create: `packages/shared/src/currency.ts`
- Create: `packages/shared/src/currency.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests for currency utilities**

Tests should cover:
- `toMinorUnits`: $12.50 → 1250 (USD), ¥1000 → 1000 (JPY), ₩5000 → 5000 (KRW)
- `fromMinorUnits`: 1250 → 12.50 (USD), 1000 → 1000 (JPY)
- `convertToBase`: USD→JPY (10050 * 148.5 / 100 = 14924), JPY→USD (1000 * 0.00673 * 100 = 673), same currency returns input
- `convertToBase` rounding: explicit .5 case (e.g., 1050 USD * 148 / 100 = 15540.0 exact; 1050 USD * 148.5 / 100 = 15592.5 → 15593)
- `formatCurrency`: 14924 JPY in "ja" → "¥14,924", 1250 USD in "en" → "$12.50"
- `CURRENCIES` has all 12 entries
- `currencyCodeSchema` accepts valid codes, rejects invalid

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run --filter @sugara/shared test -- currency`

- [ ] **Step 3: Implement currency module**

```typescript
// packages/shared/src/currency.ts
import { z } from "zod";

const CURRENCY_CODES = ["JPY", "USD", "EUR", "GBP", "AUD", "CAD", "CHF", "CNY", "KRW", "THB", "SGD", "HKD"] as const;

export const currencyCodeSchema = z.enum(CURRENCY_CODES);
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

type CurrencyDef = {
  code: CurrencyCode;
  name: string;
  nameJa: string;
  symbol: string;
  decimals: number;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  JPY: { code: "JPY", name: "Japanese Yen", nameJa: "日本円", symbol: "¥", decimals: 0 },
  USD: { code: "USD", name: "US Dollar", nameJa: "米ドル", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", name: "Euro", nameJa: "ユーロ", symbol: "€", decimals: 2 },
  GBP: { code: "GBP", name: "Pound Sterling", nameJa: "英ポンド", symbol: "£", decimals: 2 },
  AUD: { code: "AUD", name: "Australian Dollar", nameJa: "豪ドル", symbol: "A$", decimals: 2 },
  CAD: { code: "CAD", name: "Canadian Dollar", nameJa: "カナダドル", symbol: "C$", decimals: 2 },
  CHF: { code: "CHF", name: "Swiss Franc", nameJa: "スイスフラン", symbol: "CHF", decimals: 2 },
  CNY: { code: "CNY", name: "Chinese Yuan", nameJa: "人民元", symbol: "¥", decimals: 2 },
  KRW: { code: "KRW", name: "South Korean Won", nameJa: "韓国ウォン", symbol: "₩", decimals: 0 },
  THB: { code: "THB", name: "Thai Baht", nameJa: "タイバーツ", symbol: "฿", decimals: 2 },
  SGD: { code: "SGD", name: "Singapore Dollar", nameJa: "シンガポールドル", symbol: "S$", decimals: 2 },
  HKD: { code: "HKD", name: "Hong Kong Dollar", nameJa: "香港ドル", symbol: "HK$", decimals: 2 },
};

export function toMinorUnits(amount: number, currency: CurrencyCode): number {
  const { decimals } = CURRENCIES[currency];
  return Math.round(amount * 10 ** decimals);
}

export function fromMinorUnits(minorAmount: number, currency: CurrencyCode): number {
  const { decimals } = CURRENCIES[currency];
  return minorAmount / 10 ** decimals;
}

export function convertToBase(
  fromMinorUnits: number,
  fromCurrency: CurrencyCode,
  baseCurrency: CurrencyCode,
  rate: number,
): number {
  if (fromCurrency === baseCurrency) return fromMinorUnits;
  const fromDecimals = CURRENCIES[fromCurrency].decimals;
  const baseDecimals = CURRENCIES[baseCurrency].decimals;
  return Math.round(fromMinorUnits * rate * 10 ** baseDecimals / 10 ** fromDecimals);
}

export function formatCurrency(
  minorAmount: number,
  currency: CurrencyCode,
  locale: string,
): string {
  const displayAmount = fromMinorUnits(minorAmount, currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: CURRENCIES[currency].decimals,
    maximumFractionDigits: CURRENCIES[currency].decimals,
  }).format(displayAmount);
}
```

- [ ] **Step 4: Re-export from packages/shared/src/index.ts**

```typescript
export * from "./currency";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun run --filter @sugara/shared test -- currency`

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/currency.ts packages/shared/src/currency.test.ts packages/shared/src/index.ts
git commit -m "feat: 通貨定義とユーティリティ関数を追加"
```

---

## Task 2: Update Zod Schemas (Trip + Expense)

**Files:**
- Modify: `packages/shared/src/schemas/trip.ts`
- Modify: `packages/shared/src/schemas/expense.ts`

- [ ] **Step 1: Read existing schemas**

Read `packages/shared/src/schemas/trip.ts` and `packages/shared/src/schemas/expense.ts` to understand current structure.

- [ ] **Step 2: Add currency to trip schemas**

In `trip.ts`:
- Add `currency: currencyCodeSchema.optional().default("JPY")` to `createTripSchema`
- Add `currency: currencyCodeSchema.optional().default("JPY")` to `createTripWithPollSchema` (also used for poll-mode trip creation)
- Add `currency: currencyCodeSchema.optional()` to `updateTripSchema`

- [ ] **Step 3: Add currency + exchangeRate to expense schemas**

In `expense.ts`:
- Add `currency: currencyCodeSchema.optional().default("JPY")` to `createExpenseSchema`
- Add `exchangeRate: z.number().positive().max(999999).optional()` to `createExpenseSchema`
- Same for `updateExpenseSchema`
- Change `amount` from `z.number().int().min(1)` to `z.number().positive()` — amount is now in display units (e.g., 12.50 for USD), not minor units. Server converts to minor units using `toMinorUnits`.
- Add validation: when currency differs from trip currency, exchangeRate is required (this validation happens server-side, not in Zod — just add the fields)

- [ ] **Step 4: Run existing tests to verify nothing breaks**

Run: `bun run --filter @sugara/shared test`

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/trip.ts packages/shared/src/schemas/expense.ts
git commit -m "feat: trip と expense のスキーマに通貨フィールドを追加"
```

---

## Task 3: DB Schema + Migration

**Files:**
- Modify: `apps/api/src/db/schema.ts`

- [ ] **Step 1: Read existing schema**

Read `apps/api/src/db/schema.ts` — focus on `trips`, `expenses`, `expenseSplits`, `expenseLineItems`, `settlementPayments` tables.

- [ ] **Step 2: Add currency to trips table**

```typescript
currency: text("currency").notNull().default("JPY"),
```

- [ ] **Step 3: Add currency columns to expenses table**

Add `numeric` to the import from `drizzle-orm/pg-core` (not currently imported).

```typescript
currency: text("currency").notNull().default("JPY"),
exchangeRate: numeric("exchange_rate", { precision: 12, scale: 6 }),
baseAmount: integer("base_amount"),
```

- [ ] **Step 4: Generate migration**

Run: `bun run db:generate`

- [ ] **Step 5: Run migration**

Run: `bun run db:migrate`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle/
git commit -m "feat: trips と expenses テーブルに通貨カラムを追加"
```

---

## Task 4: Exchange Rate API Client + Endpoint

**Files:**
- Create: `apps/api/src/lib/exchange-rate.ts`
- Create: `apps/api/src/lib/exchange-rate.test.ts`
- Create: `apps/api/src/routes/exchange-rate.ts`
- Create: `apps/api/src/routes/exchange-rate.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write failing tests for exchange rate client**

Tests:
- `fetchExchangeRate`: returns rate on success, uses cache on second call
- Returns null on API failure
- Cache expires after TTL

- [ ] **Step 2: Implement exchange rate client**

```typescript
// apps/api/src/lib/exchange-rate.ts
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, { rate: number; fetchedAt: number }>();

export async function fetchExchangeRate(from: string, to: string): Promise<number | null> {
  const key = `${from}-${to}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data.rates?.[to];
    if (typeof rate !== "number") return null;
    cache.set(key, { rate, fetchedAt: Date.now() });
    return rate;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Write failing tests for exchange rate route**

Tests:
- Returns 200 with rate
- Returns 400 for missing params
- Returns 400 for invalid currency codes
- Returns 502 when API is down

- [ ] **Step 4: Implement exchange rate route**

```typescript
// apps/api/src/routes/exchange-rate.ts
// GET /api/exchange-rate?from=USD&to=JPY
// Returns { rate, from, to }
```

- [ ] **Step 5: Register route in app.ts**

- [ ] **Step 6: Run tests**

Run: `bun run --filter @sugara/api test -- exchange-rate`

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lib/exchange-rate.ts apps/api/src/lib/exchange-rate.test.ts apps/api/src/routes/exchange-rate.ts apps/api/src/routes/exchange-rate.test.ts apps/api/src/app.ts
git commit -m "feat: 為替レート API エンドポイントを追加"
```

---

## Task 5: Expense API — Currency Support

**Files:**
- Modify: `apps/api/src/routes/expenses.ts`
- Modify: `apps/api/src/routes/settlement-payments.ts`

- [ ] **Step 1: Read existing expense routes thoroughly**

Read `apps/api/src/routes/expenses.ts` and `apps/api/src/routes/settlement-payments.ts`. Understand:
- How amount is saved (POST/PATCH)
- How splits are calculated (calculateEqualSplit)
- How categoryTotals are computed (GET)
- How activity log is formatted
- How settlement-payments uses amounts

- [ ] **Step 2: Fetch trip currency in expense handlers**

The current POST/PATCH handlers do not fetch trip data. Add a trip query to get `trip.currency` for:
- Validating that exchangeRate is provided when `currency !== trip.currency`
- Computing baseAmount

Read existing routes to find the best pattern (e.g., `requireTripAccess` may already provide trip data, or a separate query is needed).

- [ ] **Step 3: Update POST /expenses to handle currency**

In the POST handler:
- Accept `currency` and `exchangeRate` from request body (already in schema after Task 2)
- Convert display amount to minor units: `toMinorUnits(parsed.data.amount, currency)`
- If `currency !== trip.currency` and `exchangeRate` is provided, calculate `baseAmount` using `convertToBase`
- Pass `baseAmount ?? amount` (in minor units) to `calculateEqualSplit` for equal splits
- Save `currency`, `exchangeRate`, `baseAmount` to DB
- Update activity log: use `formatCurrency(amount, currency, "ja")` instead of `\u00A5${amount.toLocaleString()}`

- [ ] **Step 4: Update PATCH /expenses to handle currency**

Same pattern as POST. When amount or currency changes, recalculate baseAmount and splits.
Also update the activity log in PATCH handler.

- [ ] **Step 5: Update DELETE /expenses activity log**

In the DELETE handler, replace `\u00A5${existing.amount.toLocaleString()}` with `formatCurrency(existing.amount, existing.currency, "ja")`.

- [ ] **Step 6: Update GET /expenses — categoryTotals and settlement**

Two changes in the GET handler:
1. `categoryTotals`: change `existing.total += e.amount` to `existing.total += e.baseAmount ?? e.amount`
2. `calculateSettlement` call: change `amount: e.amount` to `amount: e.baseAmount ?? e.amount` in the expense data passed to settlement

- [ ] **Step 7: Update settlement-payments.ts — all 3 locations**

In `settlement-payments.ts`:
1. POST handler (line ~49-54): `calculateSettlement` call — change `amount: e.amount` to `amount: e.baseAmount ?? e.amount`
2. Unsettled summary handler (line ~208-212): same change for `calculateSettlement` call
3. Activity log (lines ~84, 96, 148): replace `\u00A5${amount.toLocaleString()}` with `formatCurrency(amount, trip.currency, "ja")` — note these are settlement amounts so use trip's base currency
4. Notification payload `entityName` (line ~96): also replace hardcoded yen

- [ ] **Step 8: Run existing tests**

Run: `bun run --filter @sugara/api test`
Fix any test failures caused by schema changes (new required fields, mock data updates).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/expenses.ts apps/api/src/routes/settlement-payments.ts
git commit -m "feat: 費用 API に通貨・為替レート対応を追加"
```

---

## Task 6: Frontend — formatCurrency Migration

**Files:**
- Modify: `apps/web/components/expense-panel.tsx`
- Modify: `apps/web/components/settlement-section.tsx`
- Modify: `apps/web/components/unsettled-summary.tsx`
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/messages/en.json`

This task replaces all hardcoded ¥ and `amountWithCurrency` i18n templates with `formatCurrency()`. No new UI — just formatting migration.

- [ ] **Step 1: Read all files that use amountWithCurrency or hardcoded ¥**

Identify every usage in expense-panel.tsx, settlement-section.tsx, unsettled-summary.tsx, expense-dialog.tsx.

- [ ] **Step 2: Replace in expense-panel.tsx**

Replace all `te("amountWithCurrency", { amount: X.toLocaleString() })` with `formatCurrency(X, currency, locale)`.

For the expense list, use `expense.currency` for each expense. For totals (categoryTotals, settlement), use the trip's base currency.

The component needs access to the trip's currency. Check how it currently receives trip data.

- [ ] **Step 3: Replace in settlement-section.tsx**

Replace `te("amountWithCurrency", ...)` with `formatCurrency(amount, tripCurrency, locale)`.

- [ ] **Step 4: Replace in unsettled-summary.tsx**

Replace hardcoded `¥{owed.toLocaleString()}` and `+¥{owedTo.toLocaleString()}` with `formatCurrency()`.

The component needs the trip's base currency. Check if the API response includes it, or if it needs to be passed as a prop. If the API doesn't return it, add it to the settlement-payments response (Task 5 should have handled this).

- [ ] **Step 4b: Replace in expense-panel.tsx delete confirmation**

The delete confirmation dialog shows `amount: deleteTarget?.amount.toLocaleString()`. Replace with `formatCurrency(deleteTarget.amount, deleteTarget.currency, locale)`.

- [ ] **Step 5: Remove amountWithCurrency from i18n**

Remove the `amountWithCurrency` key from ja.json and en.json. Add any new keys needed for currency UI (e.g., `exchangeRate`, `baseCurrencyAmount`).

- [ ] **Step 6: Run type check and lint**

Run: `bun run check-types` and `bun run check`

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/expense-panel.tsx apps/web/components/settlement-section.tsx apps/web/components/unsettled-summary.tsx apps/web/messages/ja.json apps/web/messages/en.json
git commit -m "refactor: 通貨フォーマットを Intl.NumberFormat に統一"
```

---

## Task 7: Frontend — Trip Currency Selector

**Files:**
- Modify: `apps/web/components/create-trip-dialog.tsx`
- Modify: `apps/web/components/edit-trip-dialog.tsx`
- Modify: `apps/web/messages/ja.json`
- Modify: `apps/web/messages/en.json`

- [ ] **Step 1: Read existing trip dialogs**

Read `create-trip-dialog.tsx` and `edit-trip-dialog.tsx` to understand form patterns.

- [ ] **Step 2: Add i18n keys**

Add to ja.json/en.json:
- `trip.currency`: "基準通貨" / "Base Currency"
- `trip.currencyHelp`: "精算に使用する通貨です" / "Currency used for settlement"
- `trip.currencyChangeDisabled`: "費用が登録されているため変更できません" / "Cannot change because expenses exist"

- [ ] **Step 3: Add currency selector to create-trip-dialog**

Add a Select/dropdown component with the 12 currencies. Default: JPY. Show currency code + name (locale-aware). Place after the date range picker.

- [ ] **Step 4: Add currency selector to edit-trip-dialog**

Same selector, but disabled when the trip has expenses. Show explanation text when disabled.

Need to know if expenses exist — check if trip data includes expense count, or make an additional check.

- [ ] **Step 5: Run type check**

Run: `bun run check-types`

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/create-trip-dialog.tsx apps/web/components/edit-trip-dialog.tsx apps/web/messages/ja.json apps/web/messages/en.json
git commit -m "feat: 旅行作成・編集に基準通貨選択を追加"
```

---

## Task 8: Frontend — Expense Dialog Currency Support

**Files:**
- Modify: `apps/web/components/expense-dialog.tsx`
- Modify: `apps/web/lib/expense-calc.ts`

This is the most complex frontend task. The expense dialog needs currency selection, exchange rate input, and base amount display.

- [ ] **Step 1: Read expense-dialog.tsx thoroughly**

Understand the form state, amount input, split calculation, and submit handler.

- [ ] **Step 2: Add i18n keys for currency UI**

Add to ja.json/en.json:
- `expense.currency`: "通貨" / "Currency"
- `expense.exchangeRate`: "為替レート" / "Exchange Rate"
- `expense.baseAmount`: "基準通貨換算" / "Base Currency Amount"
- `expense.fetchRate`: "レート取得" / "Fetch Rate"
- `expense.fetchRateFailed`: "レートの取得に失敗しました" / "Failed to fetch exchange rate"

- [ ] **Step 3: Add currency selector to expense dialog**

Add a Select component for currency. Default: trip's base currency. When changed to a different currency:
- Show exchange rate input field (auto-fetched via `/api/exchange-rate`)
- Show calculated base amount (read-only)
- Add "Fetch Rate" button to re-fetch

- [ ] **Step 4: Update amount handling**

When currency differs from base:
- `amount` field accepts the original currency amount (display units, e.g., $12.50)
- Convert to minor units before saving: `toMinorUnits(amount, currency)`
- Calculate `baseAmount` using `convertToBase`
- Pass `baseAmount` (not `amount`) to split calculation

- [ ] **Step 5: Update expense-calc.ts**

`calculateItemizedSplits` may need to work with base amounts. Read the function and determine if changes are needed (it may already just work with whatever integer is passed).

- [ ] **Step 6: Update submit handler**

POST/PATCH body should include `currency` and `exchangeRate` (when applicable). Server computes `baseAmount`.

- [ ] **Step 7: Run type check and lint**

Run: `bun run check-types` and `bun run check`

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/expense-dialog.tsx apps/web/lib/expense-calc.ts apps/web/messages/ja.json apps/web/messages/en.json
git commit -m "feat: 費用ダイアログに通貨選択と為替レート入力を追加"
```

---

## Task 9: Expense List — Foreign Currency Display

**Files:**
- Modify: `apps/web/components/expense-panel.tsx`

- [ ] **Step 1: Update expense list to show dual amounts**

For expenses in foreign currency, show: `$100.50 (¥14,924)`
For expenses in base currency, show: `¥1,000`

The expense response needs to include `currency`, `baseAmount`. Check if the API already returns these fields after Task 5.

- [ ] **Step 2: Run type check**

Run: `bun run check-types`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/expense-panel.tsx
git commit -m "feat: 費用一覧で外貨と基準通貨換算額を併記"
```

---

## Task 10: Discord Embed + Activity Log Updates

**Files:**
- Modify: `packages/shared/src/discord-embed.ts`
- Modify: `apps/api/src/lib/notifications.ts` (if notification payload needs amount/currency)

- [ ] **Step 1: Update Discord Embed for expense_added**

Add `amount` and `currency` to the expense notification payload. Update `DISCORD_MSG_JA` / `DISCORD_MSG_EN` for `expense_added` to include the formatted amount.

Read `apps/api/src/routes/expenses.ts` to see how `notifyTripMembersExcluding` is called for expense_added — check what payload fields are available.

- [ ] **Step 2: Run tests**

Run: `bun run --filter @sugara/shared test -- discord-embed`

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/discord-embed.ts
git commit -m "feat: Discord Embed の費用通知に通貨情報を追加"
```

---

## Task 11: FAQ + News + Final Verification

**Files:**
- Modify: `apps/api/src/db/seed-faqs.ts`
- Create: `apps/web/content/news/ja/2026-03-23-multi-currency.md`
- Create: `apps/web/content/news/en/2026-03-23-multi-currency.md`

- [ ] **Step 1: Add FAQ entries**

Add to JA_FAQS and EN_FAQS:
- "How do I use different currencies?" / "異なる通貨を使うには？"
- "How are exchange rates determined?" / "為替レートはどう決まる？"

- [ ] **Step 2: Create news articles**

Follow existing format in `apps/web/content/news/`.

- [ ] **Step 3: Run full type check**

Run: `bun run check-types`

- [ ] **Step 4: Run lint**

Run: `bun run check`

- [ ] **Step 5: Run all tests**

Run: `bun run test`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/seed-faqs.ts apps/web/content/news/
git commit -m "docs: 複数通貨対応の FAQ とお知らせ記事を追加"
```

- [ ] **Step 7: Clean up plan documents**

```bash
git rm docs/plans/multi-currency.md docs/plans/multi-currency-plan.md
git commit -m "chore: 完了した計画ドキュメントを削除"
```

---

## Task Dependencies

| Task | Description | Depends On |
|------|------------|------------|
| 1 | Currency definitions + utilities | — |
| 2 | Zod schema updates | 1 |
| 3 | DB schema + migration | 2 |
| 4 | Exchange rate API | 1 |
| 5 | Expense API currency support | 1, 2, 3 |
| 6 | formatCurrency migration | 1 |
| 7 | Trip currency selector | 2, 3 |
| 8 | Expense dialog currency UI | 1, 4, 5 |
| 9 | Expense list dual display | 5, 6 |
| 10 | Discord embed + activity log | 1, 5 |
| 11 | FAQ + News + verification | All |

**Parallelizable:** Tasks 2, 4, 6 can start after Task 1. Tasks 3 and 7 can run after 2. Task 5 needs 1+2+3.
