"use client";

import type { ExpenseSplitType } from "@sugara/shared";
import { EXPENSE_TITLE_MAX_LENGTH } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, getApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type Member = { userId: string; name: string; role: string; image: string | null };
type MembersResponse = Member[];

type Expense = {
  id: string;
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  paidByUserId: string;
  splits: { userId: string; amount: number }[];
};

type ExpenseDialogProps = {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense?: Expense | null;
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
    queryFn: () => api<MembersResponse>(`/api/trips/${tripId}/members`),
    enabled: open,
  });

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByUserId, setPaidByUserId] = useState("");
  const [splitType, setSplitType] = useState<ExpenseSplitType>("equal");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens
  useEffect(() => {
    if (!open) return;
    if (expense) {
      setTitle(expense.title);
      setAmount(String(expense.amount));
      setPaidByUserId(expense.paidByUserId);
      setSplitType(expense.splitType);
      setSelectedMembers(new Set(expense.splits.map((s) => s.userId)));
      const amounts: Record<string, string> = {};
      for (const s of expense.splits) {
        amounts[s.userId] = String(s.amount);
      }
      setCustomAmounts(amounts);
    } else {
      setTitle("");
      setAmount("");
      setPaidByUserId("");
      setSplitType("equal");
      setSelectedMembers(new Set());
      setCustomAmounts({});
    }
  }, [open, expense]);

  // Auto-select all members when members are loaded and no expense
  useEffect(() => {
    if (open && !expense && members.length > 0 && selectedMembers.size === 0) {
      setSelectedMembers(new Set(members.map((m) => m.userId)));
    }
  }, [open, expense, members, selectedMembers.size]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMembers.size === 0 || !paidByUserId || parsedAmount <= 0) return;

    const splits = Array.from(selectedMembers).map((userId) => ({
      userId,
      ...(splitType === "custom" ? { amount: Number(customAmounts[userId]) || 0 } : {}),
    }));

    setLoading(true);
    try {
      if (isEdit) {
        await api(`/api/trips/${tripId}/expenses/${expense.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            amount: parsedAmount,
            paidByUserId,
            splitType,
            splits,
          }),
        });
      } else {
        await api(`/api/trips/${tripId}/expenses`, {
          method: "POST",
          body: JSON.stringify({
            title,
            amount: parsedAmount,
            paidByUserId,
            splitType,
            splits,
          }),
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "費用を編集" : "費用を追加"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "費用の内容を変更します。" : "新しい費用を記録します。"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="expense-title">タイトル</Label>
            <Input
              id="expense-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: 夕食"
              maxLength={EXPENSE_TITLE_MAX_LENGTH}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">金額 (円)</Label>
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
            <Label>支払者</Label>
            <Select value={paidByUserId} onValueChange={setPaidByUserId}>
              <SelectTrigger>
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
            <Label>分担方法</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={splitType === "equal" ? "default" : "outline"}
                size="sm"
                onClick={() => setSplitType("equal")}
              >
                均等
              </Button>
              <Button
                type="button"
                variant={splitType === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setSplitType("custom")}
              >
                カスタム
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>対象メンバー</Label>
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3">
                  <Checkbox
                    id={`member-${m.userId}`}
                    checked={selectedMembers.has(m.userId)}
                    onCheckedChange={() => toggleMember(m.userId)}
                  />
                  <label htmlFor={`member-${m.userId}`} className="flex-1 text-sm cursor-pointer">
                    {m.name}
                  </label>
                  {splitType === "custom" && selectedMembers.has(m.userId) && (
                    <Input
                      type="number"
                      className="w-24"
                      value={customAmounts[m.userId] ?? ""}
                      onChange={(e) =>
                        setCustomAmounts((prev) => ({ ...prev, [m.userId]: e.target.value }))
                      }
                      placeholder="0"
                      min={0}
                    />
                  )}
                </div>
              ))}
            </div>
            {splitType === "custom" && parsedAmount > 0 && (
              <p
                className={cn(
                  "text-xs",
                  customMismatch ? "text-destructive" : "text-muted-foreground",
                )}
              >
                合計: {customTotal.toLocaleString()}円 / {parsedAmount.toLocaleString()}円
                {customMismatch && " (一致していません)"}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                loading ||
                !title.trim() ||
                parsedAmount <= 0 ||
                selectedMembers.size === 0 ||
                customMismatch
              }
            >
              {loading ? "保存中..." : isEdit ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
