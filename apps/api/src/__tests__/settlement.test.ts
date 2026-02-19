import { describe, expect, it } from "vitest";
import { calculateEqualSplit, calculateSettlement } from "../lib/settlement";

const alice = { id: "alice-id", name: "Alice" };
const bob = { id: "bob-id", name: "Bob" };
const charlie = { id: "charlie-id", name: "Charlie" };

describe("calculateEqualSplit", () => {
  it("splits evenly when divisible", () => {
    expect(calculateEqualSplit(1000, 2)).toEqual([500, 500]);
  });

  it("adds remainder to first member", () => {
    const result = calculateEqualSplit(1000, 3);
    expect(result).toEqual([334, 333, 333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("handles single member", () => {
    expect(calculateEqualSplit(500, 1)).toEqual([500]);
  });

  it("handles remainder of 2 with 3 members", () => {
    const result = calculateEqualSplit(1001, 3);
    expect(result).toEqual([334, 334, 333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1001);
  });
});

describe("calculateSettlement", () => {
  it("returns empty transfers when no expenses", () => {
    const result = calculateSettlement([], [alice, bob]);
    expect(result.totalAmount).toBe(0);
    expect(result.balances).toEqual([
      { userId: alice.id, name: alice.name, net: 0 },
      { userId: bob.id, name: bob.name, net: 0 },
    ]);
    expect(result.transfers).toEqual([]);
  });

  it("calculates transfer for single expense between 2 members", () => {
    const result = calculateSettlement(
      [
        {
          paidByUserId: alice.id,
          amount: 1000,
          splits: [
            { userId: alice.id, amount: 500 },
            { userId: bob.id, amount: 500 },
          ],
        },
      ],
      [alice, bob],
    );

    expect(result.totalAmount).toBe(1000);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual({
      from: bob,
      to: alice,
      amount: 500,
    });
  });

  it("optimizes transfers for 3 members with multiple expenses", () => {
    const result = calculateSettlement(
      [
        {
          paidByUserId: alice.id,
          amount: 3000,
          splits: [
            { userId: alice.id, amount: 1000 },
            { userId: bob.id, amount: 1000 },
            { userId: charlie.id, amount: 1000 },
          ],
        },
        {
          paidByUserId: bob.id,
          amount: 1500,
          splits: [
            { userId: alice.id, amount: 500 },
            { userId: bob.id, amount: 500 },
            { userId: charlie.id, amount: 500 },
          ],
        },
      ],
      [alice, bob, charlie],
    );

    expect(result.totalAmount).toBe(4500);
    // Alice paid 3000, owes 1500 -> net = +1500
    // Bob paid 1500, owes 1500 -> net = 0
    // Charlie paid 0, owes 1500 -> net = -1500
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual({
      from: charlie,
      to: alice,
      amount: 1500,
    });
  });

  it("handles custom splits", () => {
    const result = calculateSettlement(
      [
        {
          paidByUserId: alice.id,
          amount: 1000,
          splits: [
            { userId: alice.id, amount: 300 },
            { userId: bob.id, amount: 700 },
          ],
        },
      ],
      [alice, bob],
    );

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toEqual({
      from: bob,
      to: alice,
      amount: 700,
    });
  });

  it("returns no transfers when everyone is even", () => {
    const result = calculateSettlement(
      [
        {
          paidByUserId: alice.id,
          amount: 1000,
          splits: [
            { userId: alice.id, amount: 500 },
            { userId: bob.id, amount: 500 },
          ],
        },
        {
          paidByUserId: bob.id,
          amount: 1000,
          splits: [
            { userId: alice.id, amount: 500 },
            { userId: bob.id, amount: 500 },
          ],
        },
      ],
      [alice, bob],
    );

    expect(result.transfers).toEqual([]);
  });

  it("handles rounding with equal split of 1000 among 3", () => {
    // 1000 / 3 = 334 + 333 + 333
    const result = calculateSettlement(
      [
        {
          paidByUserId: alice.id,
          amount: 1000,
          splits: [
            { userId: alice.id, amount: 334 },
            { userId: bob.id, amount: 333 },
            { userId: charlie.id, amount: 333 },
          ],
        },
      ],
      [alice, bob, charlie],
    );

    expect(result.totalAmount).toBe(1000);
    // Alice paid 1000, owes 334 -> net = +666
    // Bob paid 0, owes 333 -> net = -333
    // Charlie paid 0, owes 333 -> net = -333
    const totalTransfer = result.transfers.reduce((sum, t) => sum + t.amount, 0);
    expect(totalTransfer).toBe(666);
  });
});
