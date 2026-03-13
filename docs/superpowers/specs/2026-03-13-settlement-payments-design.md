# Settlement Payments (精算チェック) Design

> **For agentic workers:** Use superpowers:executing-plans to implement the plan generated from this spec.

**Goal:** 旅行で発生した精算（transfer）に支払済チェックをつけ、未精算状況を可視化する

**Context:** 現在の sugara では精算額は費用データから毎回計算して表示するのみで、実際の支払い状況を追跡する仕組みがない。本機能により、誰が誰にいくら払ったかを記録し、未精算をプロフィールやホーム画面で確認できるようにする。

---

## Data Model

### New table: `settlement_payments`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| tripId | uuid FK → trips (cascade delete) | |
| fromUserId | uuid FK → users (cascade delete) | Debtor |
| toUserId | uuid FK → users (cascade delete) | Creditor |
| amount | integer | Settlement amount (JPY) |
| paidAt | timestamp with timezone | When the check was made |
| paidByUserId | uuid FK → users (cascade delete) | Who checked it |
| createdAt | timestamp with timezone | |

Indexes:
- `(tripId)` — for lookup by trip
- `UNIQUE (tripId, fromUserId, toUserId, amount)` — prevents duplicate checks for the same transfer

The table must call `.enableRLS()` to match all other tables in the schema.

### New notification type enum value

Add `settlement_checked` to the existing `notificationTypeEnum` in schema.ts. This requires a DB migration to alter the enum.

### Auto-reset rule

When any expense in a trip is created, updated, or deleted, all `settlement_payments` for that trip are deleted. This ensures stale checks do not persist after transfer amounts change. The DELETE must be inside the same database transaction as the expense mutation.

---

## API

### Modified endpoint

**`GET /api/trips/:tripId/expenses`**

Add `settlementPayments` to the response:

```typescript
{
  expenses: ExpenseItem[]
  settlement: Settlement
  settlementPayments: SettlementPayment[]
  categoryTotals: CategoryTotal[]
}

type SettlementPayment = {
  id: string
  tripId: string
  fromUserId: string
  toUserId: string
  amount: number
  paidAt: string
  paidByUserId: string
}
```

### New endpoints

**`POST /api/trips/:tripId/settlement-payments`**

Create a settlement payment record (mark a transfer as paid).

```typescript
Request: {
  fromUserId: string  // must match transfer.from.id
  toUserId: string    // must match transfer.to.id
  amount: number      // must match transfer.amount
}

Response: 201 { settlementPayment: SettlementPayment }
```

Authorization: Caller must be `fromUserId` or `toUserId`. Must be a trip member.

Side effects:
- Create activity log: `action: "settle"`, `entityType: "settlement"`, `entityName: "{fromName} → {toName}"`, `detail: "¥{amount}"`
- Send notification (type: `settlement_checked`) to the other party only (not the caller), using `notifyUsers()` with the single recipient

Validation:
- The (fromUserId, toUserId, amount) tuple must match an existing transfer in the trip's current settlement calculation (matching against `transfer.from.id`, `transfer.to.id`, `transfer.amount`)
- The UNIQUE constraint on `(tripId, fromUserId, toUserId, amount)` prevents duplicates at the DB level; return 409 Conflict if violated

**`DELETE /api/trips/:tripId/settlement-payments/:id`**

Remove a settlement payment record (uncheck).

```typescript
Response: 204
```

Authorization: Caller must be `fromUserId` or `toUserId` of the record. Must be a trip member.

Side effects:
- Create activity log: `action: "unsettle"`, `entityType: "settlement"`, `entityName: "{fromName} → {toName}"`, `detail: "¥{amount}"`
- No notification on uncheck

**`GET /api/users/:userId/unsettled-summary`**

Get unsettled transfers across all trips for a user.

```typescript
Response: {
  totalOwed: number      // total the user needs to pay
  totalOwedTo: number    // total owed to the user
  trips: {
    tripId: string
    tripTitle: string
    transfers: {
      fromUser: { id: string; name: string }
      toUser: { id: string; name: string }
      amount: number
    }[]
  }[]
}
```

Authorization: Caller must be the user themselves (`:userId` matches session user).

Logic:
1. Find all trips where the user is a member
2. For each trip, calculate settlement (transfers)
3. Subtract settled transfers (match settlement_payments by `from.id === fromUserId && to.id === toUserId && amount === amount`)
4. Return only trips/transfers involving the user that are unsettled
5. Omit trips with no unsettled transfers involving the user

Performance note: This endpoint calculates settlement for all user's trips. This is acceptable for profile page usage (infrequent access). Cache or optimize later if needed.

### Home badge data source

Use the unsettled-summary endpoint from the profile page and cache the result client-side (React Query) to derive which trip IDs have unsettled transfers. This avoids adding per-user settlement calculation to the trip list endpoint (which would be expensive for N trips on every home page load).

### Auto-reset implementation

In the existing expense mutation handlers (`POST`, `PATCH`, `DELETE` on `/api/trips/:tripId/expenses`), add **inside the same transaction** as the expense operation:

```sql
DELETE FROM settlement_payments WHERE trip_id = :tripId
```

No notification is sent for auto-reset (the expense change notification is sufficient).

---

## Frontend

### Expense tab — Settlement section

Modify the existing settlement display in `ExpensePanel`:

- Each transfer row gets a checkbox (left side)
- Checked transfers: green checkmark + strikethrough text + muted color
- Unchecked transfers: empty checkbox + normal text
- Header: progress badge showing "n/m 完了" or "精算完了" when all are checked
- Checkbox is interactive only for the debtor or creditor of that transfer
- Others see the checkbox state but cannot toggle it

Matching logic (frontend): For each transfer in `settlement.transfers`, check if a matching `settlementPayment` exists where `transfer.from.id === payment.fromUserId && transfer.to.id === payment.toUserId && transfer.amount === payment.amount`.

### Home — Trip card badge

Add an "未精算" badge to `TripCard` when the logged-in user has unsettled transfers in that trip.

Data source: Fetch `GET /api/users/:userId/unsettled-summary` once (React Query, staleTime long), extract trip IDs from the response, and pass as a Set to `TripCard`. The badge renders if the trip's ID is in the set.

### Profile — Unsettled summary

Add a new section to the profile page (own profile only):

- Two summary cards at top: "支払い残" (red) and "受取り残" (green) with total amounts
- Below: grouped by trip, each showing individual unsettled transfers
- "あなた → {name}" for amounts the user owes
- "{name} → あなた" for amounts owed to the user
- Payment amounts colored: red for owed, green for receivable
- Section is hidden when there are no unsettled transfers

### Notification

New notification type: `settlement_checked`

Files that need updating:
- `apps/api/src/db/schema.ts` — add `settlement_checked` to `notificationTypeEnum` (requires migration)
- `packages/shared/src/schemas/notification.ts` — add to `notificationTypeSchema` Zod enum
- `packages/shared/src/schemas/notification.ts` — add to `NOTIFICATION_DEFAULTS`: `{ inApp: true, push: true }`
- `packages/shared/src/schemas/notification.ts` — add to `NOTIFICATION_TYPE_LABELS`: `"精算チェック"`
- `packages/shared/src/schemas/notification.ts` — add to `formatNotificationText()`: `"{actorName}さんが精算をチェックしました"`
- `packages/shared/src/messages.ts` — add to `PUSH_MSG`: `settlement_checked: (name: string) => \`${name}さんが精算をチェックしました\`` (key must match enum value)

When a settlement payment is created:
- Send via `notifyUsers()` to the single other party
- Notification payload: `{ actorName, tripName, entityName: "{from} → {to} ¥{amount}" }`
- Tapping navigates to the trip's expense tab

### Activity log

Settlement check/uncheck is recorded in `activity_logs`:
- Check: `action: "settle"`, `entityType: "settlement"`, `entityName: "{fromName} → {toName}"`, `detail: "¥{amount}"`
- Uncheck: `action: "unsettle"`, `entityType: "settlement"`, same format

Update `apps/web/components/activity-log.tsx`:
- Add icon for `settle`: Check (green)
- Add icon for `unsettle`: X (red)
- Add template for `entityType: "settlement"` with `action: "settle"` / `"unsettle"`

---

## Shared schemas

Add to `packages/shared/src/schemas/expense.ts`:

```typescript
export const createSettlementPaymentSchema = z.object({
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  amount: z.number().int().positive(),
})
```

Add to `packages/shared/src/types.ts`:

```typescript
export type SettlementPayment = {
  id: string
  tripId: string
  fromUserId: string
  toUserId: string
  amount: number
  paidAt: string
  paidByUserId: string
}

export type UnsettledTransfer = {
  fromUser: { id: string; name: string }
  toUser: { id: string; name: string }
  amount: number
}

export type UnsettledTrip = {
  tripId: string
  tripTitle: string
  transfers: UnsettledTransfer[]
}

export type UnsettledSummary = {
  totalOwed: number
  totalOwedTo: number
  trips: UnsettledTrip[]
}
```

---

## FAQ updates

Add to `apps/api/src/db/seed-faqs.ts`:

- Q: 精算のチェックはどうやってつけますか？
  A: 費用タブの精算セクションで、各精算の横にあるチェックボックスをタップします。支払う側・受け取る側のどちらでもチェックできます。

- Q: 精算のチェックが消えました。なぜですか？
  A: 費用が追加・編集・削除されると、精算額が変わる可能性があるため、チェックは自動的にリセットされます。

- Q: 未精算の確認はどこでできますか？
  A: プロフィール画面で全旅行の未精算サマリーを確認できます。また、ホーム画面の旅行カードに「未精算」バッジが表示されます。
