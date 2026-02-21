"use client";

import type { TripStatus } from "@sugara/shared";
import { STATUS_LABELS } from "@sugara/shared";
import { Copy, MoreHorizontal, SquareMousePointer, Trash2, X } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type StatusFilter = "all" | TripStatus;
export type SortKey = "updatedAt" | "startDate";

type TripToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  selectionMode: boolean;
  onSelectionModeChange?: (value: boolean) => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;
  deleting: boolean;
  duplicating: boolean;
  disabled: boolean;
  newTripSlot?: React.ReactNode;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  hideDuplicate?: boolean;
  hideStatusFilter?: boolean;
  hideSortKey?: boolean;
  deleteLabel?: string;
};

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as TripStatus,
    label,
  })),
];

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "updatedAt", label: "更新日" },
  { value: "startDate", label: "出発日" },
];

export function TripToolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  onSortKeyChange,
  selectionMode,
  onSelectionModeChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDeleteSelected,
  onDuplicateSelected,
  deleting,
  duplicating,
  disabled,
  newTripSlot,
  searchInputRef,
  hideDuplicate,
  hideStatusFilter,
  hideSortKey,
  deleteLabel = "旅行",
}: TripToolbarProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (selectionMode) {
    return (
      <>
        <div className="flex select-none items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onSelectionModeChange?.(false)}
            disabled={deleting || duplicating}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium">{selectedCount}件選択中</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
            disabled={deleting || duplicating}
          >
            {selectedCount === totalCount ? "全解除" : "全選択"}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={selectedCount === 0 || deleting || duplicating}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!hideDuplicate && (
                  <DropdownMenuItem onClick={onDuplicateSelected}>
                    <Copy />
                    複製
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {selectedCount}件の{deleteLabel}を削除しますか？
              </AlertDialogTitle>
              <AlertDialogDescription>
                選択した{deleteLabel}が削除されます。この操作は取り消せません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogDestructiveAction onClick={onDeleteSelected}>
                <Trash2 className="h-4 w-4" />
                削除する
              </AlertDialogDestructiveAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <div role="toolbar" aria-label="旅行フィルター" className="flex flex-wrap items-center gap-2">
      <Input
        ref={searchInputRef}
        id="trips-search"
        name="search"
        type="search"
        placeholder="検索..."
        aria-label="旅行を検索"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-full sm:w-40"
      />
      <div className="flex w-full items-center gap-1.5 [&>*]:flex-1 sm:w-auto sm:flex-1 sm:gap-2 sm:[&>*]:flex-initial">
        {!hideStatusFilter && (
          <Select
            value={statusFilter}
            onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}
          >
            <SelectTrigger className="h-8 w-[120px] text-xs" aria-label="ステータスで絞り込み">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!hideSortKey && (
          <Select value={sortKey} onValueChange={(v) => onSortKeyChange(v as SortKey)}>
            <SelectTrigger className="h-8 w-20 text-xs" aria-label="並び替え">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {onSelectionModeChange && (
          <Button
            variant="outline"
            size="sm"
            className="sm:ml-auto"
            onClick={() => onSelectionModeChange(true)}
            disabled={disabled || totalCount === 0}
          >
            <SquareMousePointer className="h-4 w-4" />
            選択
          </Button>
        )}
        {newTripSlot}
      </div>
    </div>
  );
}
