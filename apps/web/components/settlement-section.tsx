"use client";

import type { Settlement, SettlementPayment } from "@sugara/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type SettlementSectionProps = {
  tripId: string;
  settlement: Settlement;
  settlementPayments: SettlementPayment[];
  currentUserId: string | undefined;
};

function findPayment(
  payments: SettlementPayment[],
  fromId: string,
  toId: string,
  amount: number,
): SettlementPayment | undefined {
  return payments.find(
    (p) => p.fromUserId === fromId && p.toUserId === toId && p.amount === amount,
  );
}

export function SettlementSection({
  tripId,
  settlement,
  settlementPayments,
  currentUserId,
}: SettlementSectionProps) {
  const queryClient = useQueryClient();
  const transfers = [...settlement.transfers].sort((a, b) => b.amount - a.amount);
  const checkedCount = transfers.filter((t) =>
    findPayment(settlementPayments, t.from.id, t.to.id, t.amount),
  ).length;
  const allChecked = transfers.length > 0 && checkedCount === transfers.length;

  const invalidateSettlement = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
    if (currentUserId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settlement.unsettled(currentUserId),
      });
    }
  };

  const checkMutation = useMutation({
    mutationFn: (body: { fromUserId: string; toUserId: string; amount: number }) =>
      api(`/api/trips/${tripId}/settlement-payments`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: invalidateSettlement,
    onError: (err) => {
      toast.error(
        getApiErrorMessage(err, MSG.SETTLEMENT_CHECK_FAILED, {
          conflict: MSG.SETTLEMENT_ALREADY_CHECKED,
        }),
      );
    },
  });

  const uncheckMutation = useMutation({
    mutationFn: (paymentId: string) =>
      api(`/api/trips/${tripId}/settlement-payments/${paymentId}`, {
        method: "DELETE",
      }),
    onSuccess: invalidateSettlement,
    onError: (err) => {
      toast.error(getApiErrorMessage(err, MSG.SETTLEMENT_UNCHECK_FAILED));
    },
  });

  const handleToggle = (fromId: string, toId: string, amount: number) => {
    const existing = findPayment(settlementPayments, fromId, toId, amount);
    if (existing) {
      uncheckMutation.mutate(existing.id);
    } else {
      checkMutation.mutate({ fromUserId: fromId, toUserId: toId, amount });
    }
  };

  if (transfers.length === 0) return null;

  return (
    <div className="space-y-2 rounded-md border bg-muted/50 px-3 pt-2 pb-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">精算</span>
        <span
          className={`text-xs ${allChecked ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
        >
          {allChecked ? "精算完了" : `${checkedCount}/${transfers.length} 完了`}
        </span>
      </div>
      {transfers.map((t) => {
        const payment = findPayment(settlementPayments, t.from.id, t.to.id, t.amount);
        const isChecked = !!payment;
        const canToggle = currentUserId === t.from.id || currentUserId === t.to.id;
        const isLoading = checkMutation.isPending || uncheckMutation.isPending;

        return (
          <div
            key={`${t.from.id}-${t.to.id}-${t.amount}`}
            className={`relative flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm select-none ${
              canToggle
                ? "has-[:enabled]:hover:bg-muted/80 has-[:enabled]:active:bg-muted transition-colors"
                : ""
            }`}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => handleToggle(t.from.id, t.to.id, t.amount)}
              disabled={!canToggle || isLoading}
              className="h-4 w-4 before:absolute before:inset-0 before:content-['']"
            />
            <span className={isChecked ? "line-through text-muted-foreground" : ""}>
              {t.from.name}
            </span>
            <ArrowRight
              className={`h-3 w-3 shrink-0 ${isChecked ? "text-muted-foreground/50" : "text-muted-foreground"}`}
            />
            <span className={isChecked ? "line-through text-muted-foreground" : ""}>
              {t.to.name}
            </span>
            <span
              className={`ml-auto font-medium ${isChecked ? "line-through text-muted-foreground" : ""}`}
            >
              {t.amount.toLocaleString()}円
            </span>
          </div>
        );
      })}
    </div>
  );
}
