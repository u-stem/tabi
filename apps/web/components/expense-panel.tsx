"use client";

import type { ExpenseItem, ExpensesResponse } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { ExpenseDialog } from "@/components/expense-dialog";
import { ItemMenuButton } from "@/components/item-menu-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type ExpensePanelProps = {
  tripId: string;
  canEdit: boolean;
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
};

export function ExpensePanel({ tripId, canEdit, addOpen, onAddOpenChange }: ExpensePanelProps) {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.expenses.list(tripId),
    queryFn: () => api<ExpensesResponse>(`/api/trips/${tripId}/expenses`),
  });

  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  const dialogOpen = addOpen ?? internalDialogOpen;
  const setDialogOpen = onAddOpenChange ?? setInternalDialogOpen;
  const [editingExpenseItem, setEditingExpenseItem] = useState<ExpenseItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseItem | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) =>
      api(`/api/trips/${tripId}/expenses/${expenseId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, MSG.EXPENSE_DELETE_FAILED));
    },
  });

  const handleSaved = () => {
    setEditingExpenseItem(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(tripId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.activityLogs(tripId) });
  };

  const handleEdit = (expense: ExpenseItem) => {
    setEditingExpenseItem(expense);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingExpenseItem(null);
    setDialogOpen(true);
  };

  const { expenses, settlement } = data ?? {
    expenses: [],
    settlement: { totalAmount: 0, balances: [], transfers: [] },
  };

  return (
    <LoadingBoundary
      isLoading={isLoading}
      skeleton={
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-md" />
        </div>
      }
    >
      {isError ? (
        <p className="py-4 text-center text-sm text-destructive">費用データの取得に失敗しました</p>
      ) : (
        <div className="space-y-4">
          {/* Toolbar (hidden on mobile where FAB is used) */}
          {canEdit && !isMobile && (
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
                    <p className="text-xs text-muted-foreground">立替状況</p>
                    {[...settlement.balances]
                      .filter((b) => b.net !== 0)
                      .sort((a, b) => b.net - a.net)
                      .map((b) => (
                        <div
                          key={b.userId}
                          className="flex items-center justify-between pl-2 text-sm"
                        >
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
              <p className="px-3 pb-3 text-xs text-muted-foreground">{MSG.EMPTY_EXPENSE}</p>
            )}
          </CollapsiblePrimitive.Root>

          {/* ExpenseItem list */}
          {expenses.length > 0 && (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <ExpenseRow
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
            onOpenChange={(open) => {
              if (!open) setEditingExpenseItem(null);
              setDialogOpen(open);
            }}
            expense={editingExpenseItem}
            onSaved={handleSaved}
          />

          <ResponsiveAlertDialog
            open={!!deleteTarget}
            onOpenChange={(v) => !v && setDeleteTarget(null)}
          >
            <ResponsiveAlertDialogContent>
              <ResponsiveAlertDialogHeader>
                <ResponsiveAlertDialogTitle>費用を削除しますか?</ResponsiveAlertDialogTitle>
                <ResponsiveAlertDialogDescription>
                  「{deleteTarget?.title}」({deleteTarget?.amount.toLocaleString()}円)
                  を削除します。この操作は取り消せません。
                </ResponsiveAlertDialogDescription>
              </ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogFooter>
                <ResponsiveAlertDialogCancel>
                  <X className="h-4 w-4" />
                  キャンセル
                </ResponsiveAlertDialogCancel>
                <ResponsiveAlertDialogDestructiveAction
                  onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  削除する
                </ResponsiveAlertDialogDestructiveAction>
              </ResponsiveAlertDialogFooter>
            </ResponsiveAlertDialogContent>
          </ResponsiveAlertDialog>
        </div>
      )}
    </LoadingBoundary>
  );
}

function ExpenseRow({
  expense,
  canEdit,
  isMobile,
  onEdit,
  onDelete,
}: {
  expense: ExpenseItem;
  canEdit: boolean;
  isMobile: boolean;
  onEdit: (expense: ExpenseItem) => void;
  onDelete: (expense: ExpenseItem) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <CollapsiblePrimitive.Root className="rounded-md border">
      <div className="flex items-center justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{expense.title}</p>
          <p className="text-xs text-muted-foreground">
            {expense.paidByUser.name}が支払い
            {expense.splitType === "equal"
              ? " / 均等"
              : expense.splitType === "itemized"
                ? " / アイテム別"
                : " / カスタム"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-bold">{expense.amount.toLocaleString()}円</span>
          {canEdit &&
            (isMobile ? (
              <>
                <ItemMenuButton
                  ariaLabel={`${expense.title}のメニュー`}
                  onClick={() => setSheetOpen(true)}
                />
                <ActionSheet
                  open={sheetOpen}
                  onOpenChange={setSheetOpen}
                  actions={[
                    {
                      label: "編集",
                      icon: <Pencil className="h-4 w-4" />,
                      onClick: () => onEdit(expense),
                    },
                    {
                      label: "削除",
                      icon: <Trash2 className="h-4 w-4" />,
                      onClick: () => onDelete(expense),
                      variant: "destructive" as const,
                    },
                  ]}
                />
              </>
            ) : (
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
            ))}
        </div>
      </div>
      {expense.splits.length > 0 && (
        <>
          <CollapsiblePrimitive.Trigger className="flex w-full items-center gap-1 border-t px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/80 transition-colors [&[data-state=open]>svg]:rotate-180">
            <ChevronDown className="h-3 w-3 transition-transform duration-200" />
            内訳を表示
          </CollapsiblePrimitive.Trigger>
          <CollapsiblePrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
            {expense.lineItems.length > 0 && (
              <div className="space-y-1 border-t px-3 pt-2 pb-3">
                <p className="text-xs text-muted-foreground">品目</p>
                {expense.lineItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between pl-2 text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      {item.name}
                      <span className="text-xs text-muted-foreground">
                        ({item.members.length}人)
                      </span>
                    </span>
                    <span className="font-medium">{item.amount.toLocaleString()}円</span>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1 border-t px-3 pt-2 pb-3">
              {expense.lineItems.length > 0 && (
                <p className="text-xs text-muted-foreground">負担額</p>
              )}
              {[...expense.splits]
                .sort((a, b) => b.amount - a.amount)
                .map((split) => (
                  <div
                    key={split.userId}
                    className="flex items-center justify-between pl-2 text-sm"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                      {split.user.name}
                    </span>
                    <span className="font-medium">{split.amount.toLocaleString()}円</span>
                  </div>
                ))}
            </div>
          </CollapsiblePrimitive.Content>
        </>
      )}
    </CollapsiblePrimitive.Root>
  );
}
