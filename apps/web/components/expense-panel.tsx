"use client";

import type { ExpenseSplitType } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ExpenseDialog } from "@/components/expense-dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";

type ExpenseSplit = {
  userId: string;
  amount: number;
  user: { id: string; name: string };
};

type Expense = {
  id: string;
  title: string;
  amount: number;
  splitType: ExpenseSplitType;
  paidByUserId: string;
  paidByUser: { id: string; name: string };
  splits: ExpenseSplit[];
  createdAt: string;
};

type Transfer = {
  from: { id: string; name: string };
  to: { id: string; name: string };
  amount: number;
};

type Settlement = {
  totalAmount: number;
  balances: { userId: string; name: string; net: number }[];
  transfers: Transfer[];
};

type ExpensesResponse = {
  expenses: Expense[];
  settlement: Settlement;
};

type ExpensePanelProps = {
  tripId: string;
  canEdit: boolean;
};

export function ExpensePanel({ tripId, canEdit }: ExpensePanelProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.expenses.list(tripId),
    queryFn: () => api<ExpensesResponse>(`/api/trips/${tripId}/expenses`),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) =>
      api(`/api/trips/${tripId}/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to delete expense"));
    },
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingExpense(null);
    setDialogOpen(true);
  };

  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    );
  }

  if (isLoading) return null;

  if (isError) {
    return (
      <p className="py-4 text-center text-sm text-destructive">費用データの取得に失敗しました</p>
    );
  }

  const { expenses, settlement } = data ?? {
    expenses: [],
    settlement: { totalAmount: 0, balances: [], transfers: [] },
  };

  return (
    <div className="space-y-4">
      {/* Settlement summary */}
      <div className="rounded-md border bg-muted/50 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">合計</span>
          <span className="text-sm font-bold">{settlement.totalAmount.toLocaleString()}円</span>
        </div>
        {settlement.transfers.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">精算</p>
            {settlement.transfers.map((t, i) => (
              <div
                key={`${t.from.id}-${t.to.id}-${i}`}
                className="flex items-center gap-1.5 text-sm"
              >
                <span>{t.from.name}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span>{t.to.name}</span>
                <span className="ml-auto font-medium">{t.amount.toLocaleString()}円</span>
              </div>
            ))}
          </div>
        )}
        {settlement.totalAmount === 0 && (
          <p className="text-xs text-muted-foreground">費用はまだ記録されていません</p>
        )}
      </div>

      {/* Expense list */}
      {expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <button
              key={expense.id}
              type="button"
              onClick={() => canEdit && handleEdit(expense)}
              disabled={!canEdit}
              className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-60 disabled:cursor-default"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{expense.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {expense.paidByUser.name}が支払い
                    {expense.splitType === "equal" ? " / 均等" : " / カスタム"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold">{expense.amount.toLocaleString()}円</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(expense);
                      }}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add button */}
      {canEdit && (
        <Button variant="outline" size="sm" className="w-full" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          費用を追加
        </Button>
      )}

      {/* Dialogs */}
      <ExpenseDialog
        tripId={tripId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editingExpense}
        onSaved={handleSaved}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>費用を削除しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」({deleteTarget?.amount.toLocaleString()}円)
              を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
