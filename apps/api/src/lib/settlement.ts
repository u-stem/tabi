type ExpenseData = {
  paidByUserId: string;
  amount: number;
  splits: { userId: string; amount: number }[];
};

type UserInfo = { id: string; name: string };

type Settlement = {
  totalAmount: number;
  balances: { userId: string; name: string; net: number }[];
  transfers: { from: UserInfo; to: UserInfo; amount: number }[];
};

export function calculateEqualSplit(totalAmount: number, memberCount: number): number[] {
  const base = Math.floor(totalAmount / memberCount);
  const remainder = totalAmount - base * memberCount;
  return Array.from({ length: memberCount }, (_, i) => (i < remainder ? base + 1 : base));
}

export function calculateSettlement(expenses: ExpenseData[], members: UserInfo[]): Settlement {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  const netMap = new Map(members.map((m) => [m.id, 0]));

  let totalAmount = 0;

  for (const expense of expenses) {
    totalAmount += expense.amount;
    netMap.set(expense.paidByUserId, (netMap.get(expense.paidByUserId) ?? 0) + expense.amount);
    for (const split of expense.splits) {
      netMap.set(split.userId, (netMap.get(split.userId) ?? 0) - split.amount);
    }
  }

  const balances = members.map((m) => ({
    userId: m.id,
    name: m.name,
    net: netMap.get(m.id) ?? 0,
  }));

  // Greedy algorithm: match largest debtor with largest creditor
  const creditors: { user: UserInfo; amount: number }[] = [];
  const debtors: { user: UserInfo; amount: number }[] = [];

  for (const [userId, net] of netMap) {
    const user = memberMap.get(userId);
    if (!user) continue;
    if (net > 0) creditors.push({ user, amount: net });
    if (net < 0) debtors.push({ user, amount: -net });
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transfers: Settlement["transfers"] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount);
    if (transfer > 0) {
      transfers.push({
        from: debtors[di].user,
        to: creditors[ci].user,
        amount: transfer,
      });
    }
    creditors[ci].amount -= transfer;
    debtors[di].amount -= transfer;
    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount === 0) di++;
  }

  return { totalAmount, balances, transfers };
}
