# Multi-Currency Support Design

## Overview

Add multi-currency support to trip expenses. Each trip has a base currency; expenses can be in any of 12 supported currencies. Foreign-currency expenses are converted to the base currency at a user-editable exchange rate (auto-fetched from frankfurter.dev as default).

## Scope

### In scope

- 12 currencies: JPY, USD, EUR, GBP, AUD, CAD, CHF, CNY, KRW, THB, SGD, HKD
- Base currency per trip (default JPY, set at creation, editable)
- Per-expense currency selection with exchange rate input
- Exchange rate auto-fetch from frankfurter.dev (default value, user-editable)
- Settlement calculated in base currency
- Amounts stored as integers in minor units (cents, yen, won)
- Currency formatting via `Intl.NumberFormat` (replaces i18n `amountWithCurrency` templates)
- Existing trips auto-set to JPY, existing expense data unchanged

### Out of scope

- TWD (not supported by frankfurter.dev)
- DB-level rate cache (memory cache only)
- Cross-currency direct settlement (all via base currency)

## Supported Currencies

| Code | Name | Symbol | Decimals |
|------|------|--------|:--------:|
| JPY | Japanese Yen | ¥ | 0 |
| USD | US Dollar | $ | 2 |
| EUR | Euro | € | 2 |
| GBP | Pound Sterling | £ | 2 |
| AUD | Australian Dollar | A$ | 2 |
| CAD | Canadian Dollar | C$ | 2 |
| CHF | Swiss Franc | CHF | 2 |
| CNY | Chinese Yuan | ¥ | 2 |
| KRW | South Korean Won | ₩ | 0 |
| THB | Thai Baht | ฿ | 2 |
| SGD | Singapore Dollar | S$ | 2 |
| HKD | Hong Kong Dollar | HK$ | 2 |

## DB Schema Changes

### `trips` table

Add column:
- `currency TEXT NOT NULL DEFAULT 'JPY'` — base currency for settlement

Migration sets existing rows to `'JPY'`.

### `expenses` table

Add columns:
- `currency TEXT NOT NULL DEFAULT 'JPY'` — currency of this expense
- `exchange_rate NUMERIC NULL` — rate to base currency (NULL when same as base)
- `base_amount INTEGER NULL` — amount converted to base currency in minor units (NULL when same as base)

Existing data: `currency = 'JPY'`, `exchange_rate = NULL`, `base_amount = NULL`. No data transformation needed since existing amounts are already JPY minor units.

### Storage example

Trip base currency: JPY. Expense: $100.50 at rate 148.5.

| Column | Value | Notes |
|--------|-------|-------|
| currency | `'USD'` | |
| amount | `10050` | $100.50 in cents |
| exchange_rate | `148.5` | USD → JPY |
| base_amount | `14924` | ¥14,924 (10050 * 148.5 / 100, rounded) |

## Shared Package (`packages/shared`)

### Currency definitions

New file `packages/shared/src/currency.ts`:

```typescript
type CurrencyDef = {
  code: string;
  name: string;
  nameJa: string;
  symbol: string;
  decimals: number;
};

const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  JPY: { code: "JPY", name: "Japanese Yen", nameJa: "日本円", symbol: "¥", decimals: 0 },
  USD: { code: "USD", name: "US Dollar", nameJa: "米ドル", symbol: "$", decimals: 2 },
  // ... all 12
};
```

### Utility functions

- `toMinorUnits(amount: number, currency: CurrencyCode): number` — display → minor ($12.50 → 1250)
- `fromMinorUnits(amount: number, currency: CurrencyCode): number` — minor → display (1250 → 12.50)
- `formatCurrency(minorAmount: number, currency: CurrencyCode, locale: string): string` — format via `Intl.NumberFormat`
- `convertToBase(minorAmount: number, fromCurrency: CurrencyCode, baseCurrency: CurrencyCode, rate: number): number` — convert and return base minor units

### Zod schemas

- `currencyCodeSchema = z.enum(["JPY", "USD", ...])` — validates currency code
- Update `createExpenseSchema` / `updateExpenseSchema` with `currency`, `exchangeRate`, `baseAmount`
- Update `createTripSchema` / `updateTripSchema` with `currency`

## API Changes

### Exchange rate endpoint

`GET /api/exchange-rate?from=USD&to=JPY`

- Calls frankfurter.dev: `GET https://api.frankfurter.dev/v1/latest?from=USD&to=JPY`
- Memory cache with 1-hour TTL
- Returns `{ rate: 148.5, from: "USD", to: "JPY" }`
- Returns 502 if frankfurter.dev is down (frontend falls back to manual input)
- Rate limiting via existing `rateLimitByIp`

### Expense routes changes

- POST/PATCH: accept `currency`, `exchangeRate` fields
- Server calculates `baseAmount` from `amount`, `exchangeRate`, and currency decimals
- Validation: if `currency !== trip.currency`, `exchangeRate` is required

### Settlement calculation

- Use `baseAmount ?? amount` for each expense
- Result is in trip's base currency
- No changes to settlement algorithm, only the input amounts change

## Frontend Changes

### Currency formatting

Replace all `te("amountWithCurrency", { amount })` and `¥${amount.toLocaleString()}` with `formatCurrency()`.

Remove `amountWithCurrency` i18n key from `ja.json` / `en.json`.

### Trip creation/edit

- Add currency selector (dropdown with flag/symbol) to create-trip-dialog and edit-trip-dialog
- Default: JPY
- Edit: show warning if trip has expenses ("changing base currency will not re-convert existing expenses")

### Expense creation/edit

- Add currency selector to expense-dialog
- Default: trip's base currency
- When different currency selected:
  - Show exchange rate input (auto-filled from API)
  - Show calculated base amount below (read-only, live-updating)
  - "Auto-fetch" button to re-fetch rate if user cleared it
- When same as base currency: hide rate/conversion fields

### Expense list

- Show amount in original currency with currency symbol
- If foreign currency, show base amount in parentheses: `$100.50 (¥14,924)`

### Settlement / unsettled summary

- Display in base currency (uses `baseAmount ?? amount`)
- No UI changes needed beyond using `formatCurrency()` instead of hardcoded ¥

## Activity Log

- Update expense activity log messages to include currency symbol
- `¥${amount.toLocaleString()}` → `formatCurrency(amount, currency, locale)`

## Discord Embed

- Update Discord Embed messages for expense_added to include currency

## Existing Data Compatibility

- Migration adds columns with defaults, no data transformation
- `baseAmount ?? amount` pattern ensures existing JPY-only expenses work without changes
- `exchangeRate = NULL` means same currency (no conversion)

## Testing Strategy

- Unit tests: `toMinorUnits`, `fromMinorUnits`, `formatCurrency`, `convertToBase`
- Unit tests: exchange rate cache logic
- Unit tests: settlement calculation with mixed currencies
- Integration tests: expense CRUD with foreign currency
- Integration tests: exchange rate API endpoint

## FAQ Updates

Add entries (JA + EN):
- "How do I use different currencies in a trip?"
- "How are exchange rates determined?"

## News Article

Add announcement for multi-currency support.
