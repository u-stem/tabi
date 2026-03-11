"use client";

import type { ExpenseItem, ExpenseSplitType, MemberResponse } from "@sugara/shared";
import { EXPENSE_TITLE_MAX_LENGTH } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, getApiErrorMessage } from "@/lib/api";
import { calculateItemizedSplits, type ExpenseLineItem } from "@/lib/expense-calc";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type ExpenseDialogProps = {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: ExpenseItem | null;
  onSaved: () => void;
};

export function ExpenseDialog({
  tripId,
  open,
  onOpenChange,
  expense,
  onSaved,
}: ExpenseDialogProps) {
  const isEdit = !!expense;

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.trips.members(tripId),
    queryFn: () => api<MemberResponse[]>(`/api/trips/${tripId}/members`),
    enabled: open,
  });

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByUserId, setPaidByUserId] = useState("");
  const [splitType, setSplitType] = useState<ExpenseSplitType>("equal");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lineItems, setLineItems] = useState<ExpenseLineItem[]>([]);
  const [splitTheRest, setSplitTheRest] = useState(false);
  const [membersInitialized, setMembersInitialized] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
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
    } else {
      setTitle("");
      setAmount("");
      setPaidByUserId("");
      setSplitType("equal");
      setSelectedMembers(new Set());
      setCustomAmounts({});
      setLineItems([]);
      setSplitTheRest(false);
      setMembersInitialized(false);
    }
  }, [open, expense]);

  // Auto-select all members only on first load for new expense
  useEffect(() => {
    if (open && !membersInitialized && !expense && members.length > 0) {
      setSelectedMembers(new Set(members.map((m) => m.userId)));
      setMembersInitialized(true);
    }
  }, [open, membersInitialized, expense, members]);

  // Auto-set paidBy when members are loaded and no payer is set
  useEffect(() => {
    if (open && !paidByUserId && members.length > 0) {
      setPaidByUserId(members[0].userId);
    }
  }, [open, paidByUserId, members]);

  const toggleMember = useCallback((userId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }, []);

  const customTotal = Array.from(selectedMembers).reduce(
    (sum, id) => sum + (Number(customAmounts[id]) || 0),
    0,
  );
  const parsedAmount = Number(amount) || 0;
  const customMismatch = splitType === "custom" && customTotal !== parsedAmount;

  // Itemized split calculations
  const allMemberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
  const itemsTotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const restAmount = parsedAmount - itemsTotal;

  const effectiveItems =
    splitTheRest && restAmount > 0
      ? [
          ...lineItems,
          { id: "__rest__", name: "その他", amount: restAmount, memberIds: allMemberIds },
        ]
      : lineItems;

  const itemizedSplits =
    splitType === "itemized"
      ? calculateItemizedSplits(
          effectiveItems.map((item) => ({ ...item, amount: Number(item.amount) || 0 })),
        )
      : [];

  const itemizedTotal = itemizedSplits.reduce((sum, s) => sum + s.amount, 0);
  const itemizedMismatch = splitType === "itemized" && itemizedTotal !== parsedAmount;
  const hasInvalidLineItems =
    splitType === "itemized" &&
    lineItems.some((item) => item.amount <= 0 || item.memberIds.size === 0);

  const addLineItem = useCallback(() => {
    setLineItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", amount: 0, memberIds: new Set(allMemberIds) },
    ]);
  }, [allMemberIds]);

  const removeLineItem = useCallback((id: string) => {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateLineItem = useCallback(
    (id: string, updates: Partial<Pick<ExpenseLineItem, "name" | "amount">>) => {
      setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
    },
    [],
  );

  const toggleLineItemMember = useCallback((itemId: string, userId: string) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const next = new Set(item.memberIds);
        if (next.has(userId)) {
          next.delete(userId);
        } else {
          next.add(userId);
        }
        return { ...item, memberIds: next };
      }),
    );
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0 || !paidByUserId) return;

    let splits: { userId: string; amount?: number }[];

    if (splitType === "itemized") {
      splits = itemizedSplits;
    } else if (splitType === "custom") {
      if (selectedMembers.size === 0) return;
      splits = Array.from(selectedMembers).map((userId) => ({
        userId,
        amount: Number(customAmounts[userId]) || 0,
      }));
    } else {
      if (selectedMembers.size === 0) return;
      splits = Array.from(selectedMembers).map((userId) => ({ userId }));
    }

    const lineItemsPayload =
      splitType === "itemized"
        ? effectiveItems.map((item) => ({
            name: item.name,
            amount: Number(item.amount) || 0,
            memberIds: Array.from(item.memberIds),
          }))
        : undefined;

    setLoading(true);
    try {
      const body = {
        title,
        amount: parsedAmount,
        paidByUserId,
        splitType,
        splits,
        ...(lineItemsPayload ? { lineItems: lineItemsPayload } : {}),
      };
      if (isEdit) {
        await api(`/api/trips/${tripId}/expenses/${expense.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api(`/api/trips/${tripId}/expenses`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Failed to save expense"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{isEdit ? "費用を編集" : "費用を追加"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isEdit ? "費用の内容を変更します。" : "新しい費用を記録します。"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-title">
              タイトル <span className="text-destructive">*</span>
            </Label>
            <Input
              id="expense-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 夕食"
              maxLength={EXPENSE_TITLE_MAX_LENGTH}
              required
            />
            <p className="text-right text-xs text-muted-foreground">
              {title.length}/{EXPENSE_TITLE_MAX_LENGTH}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">
              金額 (円) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="expense-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min={1}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-paid-by">
              支払者 <span className="text-destructive">*</span>
            </Label>
            <Select value={paidByUserId} onValueChange={setPaidByUserId}>
              <SelectTrigger id="expense-paid-by">
                <SelectValue placeholder="選択" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label asChild>
              <span>分担方法</span>
            </Label>
            <Tabs value={splitType} onValueChange={(v) => setSplitType(v as ExpenseSplitType)}>
              <TabsList className="w-full">
                <TabsTrigger value="equal" className="flex-1">
                  均等
                </TabsTrigger>
                <TabsTrigger value="custom" className="flex-1">
                  カスタム
                </TabsTrigger>
                <TabsTrigger value="itemized" className="flex-1">
                  アイテム別
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {splitType === "equal" && "選択したメンバーで均等に割り勘します"}
              {splitType === "custom" && "メンバーごとに負担額を指定します"}
              {splitType === "itemized" && "品目ごとに対象メンバーを選んで割り勘します"}
            </p>
          </div>

          {splitType !== "itemized" && (
            <div className="space-y-2">
              <Label asChild>
                <span>対象メンバー</span>
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleMember(m.userId)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      selectedMembers.has(m.userId)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              {splitType === "custom" && (
                <div className="space-y-2">
                  {members
                    .filter((m) => selectedMembers.has(m.userId))
                    .map((m) => (
                      <div key={m.userId} className="flex items-center gap-3">
                        <span className="flex-1 text-sm">{m.name}</span>
                        <Input
                          id={`split-${m.userId}`}
                          type="number"
                          className="w-24"
                          aria-label={`${m.name}の負担額`}
                          value={customAmounts[m.userId] ?? ""}
                          onChange={(e) =>
                            setCustomAmounts((prev) => ({ ...prev, [m.userId]: e.target.value }))
                          }
                          placeholder="0"
                          min={0}
                        />
                      </div>
                    ))}
                  {parsedAmount > 0 && (
                    <p
                      className={cn(
                        "text-xs",
                        customMismatch ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      合計: {customTotal.toLocaleString()}円 / {parsedAmount.toLocaleString()}円
                      {customMismatch &&
                        ` (${
                          parsedAmount > customTotal
                            ? `残り ${(parsedAmount - customTotal).toLocaleString()}円`
                            : `${(customTotal - parsedAmount).toLocaleString()}円 超過`
                        })`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {splitType === "itemized" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label asChild>
                  <span>品目</span>
                </Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-3.5 w-3.5" /> 品目を追加
                </Button>
              </div>

              {lineItems.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">
                  品目を追加してください
                </p>
              )}

              {lineItems.map((item) => (
                <div key={item.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateLineItem(item.id, { name: e.target.value })}
                      placeholder="品目名"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={item.amount || ""}
                      onChange={(e) =>
                        updateLineItem(item.id, { amount: Number(e.target.value) || 0 })
                      }
                      placeholder="金額"
                      className="w-24"
                      min={0}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => removeLineItem(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => toggleLineItemMember(item.id, m.userId)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-colors",
                          item.memberIds.has(m.userId)
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                  {item.amount <= 0 && (
                    <p className="text-xs text-destructive">金額を入力してください</p>
                  )}
                  {item.memberIds.size === 0 && (
                    <p className="text-xs text-destructive">対象メンバーを選択してください</p>
                  )}
                </div>
              ))}

              {/* Split the rest */}
              {parsedAmount > 0 && (
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {itemsTotal > 0
                        ? `品目合計: ${itemsTotal.toLocaleString()}円 / ${parsedAmount.toLocaleString()}円`
                        : `合計: ${parsedAmount.toLocaleString()}円`}
                    </p>
                    {restAmount > 0 && (
                      <Button
                        type="button"
                        variant={splitTheRest ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSplitTheRest((prev) => !prev)}
                      >
                        {splitTheRest
                          ? `残り ${restAmount.toLocaleString()}円 均等割り中`
                          : `残り ${restAmount.toLocaleString()}円を均等割り`}
                      </Button>
                    )}
                  </div>

                  {/* Per-member summary */}
                  {itemizedSplits.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground">負担額</p>
                      {itemizedSplits.map((s) => {
                        const member = members.find((m) => m.userId === s.userId);
                        return (
                          <div key={s.userId} className="flex items-center justify-between text-sm">
                            <span>{member?.name ?? s.userId}</span>
                            <span className="font-medium">{s.amount.toLocaleString()}円</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </ResponsiveDialogClose>
            <Button
              type="submit"
              disabled={
                loading ||
                !title.trim() ||
                parsedAmount <= 0 ||
                (splitType === "equal" && selectedMembers.size === 0) ||
                (splitType === "custom" && (selectedMembers.size === 0 || customMismatch)) ||
                (splitType === "itemized" &&
                  (lineItems.length === 0 || itemizedMismatch || hasInvalidLineItems))
              }
            >
              {loading ? (
                isEdit ? (
                  "更新中..."
                ) : (
                  "追加中..."
                )
              ) : isEdit ? (
                <>
                  <Check className="h-4 w-4" /> 更新
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" /> 追加
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
