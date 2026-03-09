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
