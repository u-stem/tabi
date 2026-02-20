"use client";

import type { ExpenseSplitType } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import { ExpenseDialog } from "@/components/expense-dialog";
import { ItemMenuButton } from "@/components/item-menu-button";
import { SwipeableCard } from "@/components/swipeable-card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
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
  const isMobile = useIsMobile();
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
      {/* Toolbar */}
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
            費用を追加
          </Button>
        </div>
      )}

      {/* Settlement summary */}
      <CollapsiblePrimitive.Root className="rounded-md border bg-muted/50">
        <div className="flex items-center justify-between p-3">
          <span className="text-sm font-medium">合計支出</span>
          <span className="text-sm font-bold">{settlement.totalAmount.toLocaleString()}円</span>
        </div>
        {settlement.transfers.length > 0 && (
          <>
            <CollapsiblePrimitive.Trigger className="flex w-full items-center gap-1 border-t px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 transition-colors [&[data-state=open]>svg]:rotate-180">
              <ChevronDown className="h-3 w-3 transition-transform duration-200" />
              明細を表示
            </CollapsiblePrimitive.Trigger>
            <CollapsiblePrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <div className="space-y-1 border-t px-3 pt-2 pb-3">
                <p className="text-xs text-muted-foreground">過不足</p>
                {[...settlement.balances]
                  .filter((b) => b.net !== 0)
                  .sort((a, b) => b.net - a.net)
                  .map((b) => (
                    <div key={b.userId} className="flex items-center justify-between pl-2 text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        {b.name}
                      </span>
                      <span
                        className={
                          b.net > 0
                            ? "font-medium text-emerald-600 dark:text-emerald-400"
                            : "font-medium text-destructive"
                        }
                      >
                        {b.net > 0 ? "+" : ""}
                        {b.net.toLocaleString()}円
                      </span>
                    </div>
                  ))}
              </div>
              <div className="space-y-1 border-t px-3 pt-2 pb-3">
                <p className="text-xs text-muted-foreground">精算</p>
                {[...settlement.transfers]
                  .sort((a, b) => b.amount - a.amount)
                  .map((t, i) => (
                    <div
                      key={`${t.from.id}-${t.to.id}-${i}`}
                      className="flex items-center gap-1.5 pl-2 text-sm"
                    >
                      <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      <span>{t.from.name}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span>{t.to.name}</span>
                      <span className="ml-auto font-medium">{t.amount.toLocaleString()}円</span>
                    </div>
                  ))}
              </div>
            </CollapsiblePrimitive.Content>
          </>
        )}
        {settlement.totalAmount === 0 && (
          <p className="px-3 pb-3 text-xs text-muted-foreground">費用はまだ記録されていません</p>
        )}
      </CollapsiblePrimitive.Root>

      {/* Expense list */}
      {expenses.length > 0 && (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <ExpenseItem
              key={expense.id}
              expense={expense}
              canEdit={canEdit}
              isMobile={isMobile}
              onEdit={handleEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
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

function ExpenseItem({
  expense,
  canEdit,
  isMobile,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  canEdit: boolean;
  isMobile: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
}) {
  const canSwipe = isMobile && canEdit;

  const cardElement = (
    <div className="rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{expense.title}</p>
          <p className="text-xs text-muted-foreground">
            {expense.paidByUser.name}が支払い
            {expense.splitType === "equal" ? " / 均等" : " / カスタム"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold">{expense.amount.toLocaleString()}円</span>
          {canEdit && !isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ItemMenuButton ariaLabel={`${expense.title}のメニュー`} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(expense)}>
                  <Pencil /> 編集
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(expense)}>
                  <Trash2 /> 削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );

  if (canSwipe) {
    return (
      <SwipeableCard
        actions={[
          {
            label: "編集",
            icon: <Pencil className="h-4 w-4" />,
            color: "blue",
            onClick: () => onEdit(expense),
          },
          {
            label: "削除",
            icon: <Trash2 className="h-4 w-4" />,
            color: "red",
            onClick: () => onDelete(expense),
          },
        ]}
      >
        {cardElement}
      </SwipeableCard>
    );
  }

  return cardElement;
}
