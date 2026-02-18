"use client";

import type { TripStatus } from "@sugara/shared";
import { STATUS_LABELS } from "@sugara/shared";
import { CheckCheck, Copy, SquareMousePointer, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
}: TripToolbarProps) {
  if (selectionMode) {
    return (
      <div role="toolbar" aria-label="選択操作" className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            disabled={deleting || duplicating}
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">全選択</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeselectAll}
            disabled={deleting || duplicating}
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">選択解除</span>
          </Button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicateSelected}
            disabled={selectedCount === 0 || deleting || duplicating}
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">{duplicating ? "複製中..." : "複製"}</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedCount === 0 || deleting || duplicating}
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">{deleting ? "削除中..." : "削除"}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{selectedCount}件の旅行を削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  選択した旅行とすべての予定が削除されます。この操作は取り消せません。
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectionModeChange?.(false)}
            disabled={deleting || duplicating}
          >
            キャンセル
          </Button>
        </div>
      </div>
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
      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
          <SelectTrigger className="h-8 w-[100px] text-xs" aria-label="ステータスで絞り込み">
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
      </div>
      <div className="flex items-center gap-2 ml-auto">
        {onSelectionModeChange && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectionModeChange(true)}
            disabled={disabled || totalCount === 0}
          >
            <SquareMousePointer className="h-4 w-4" />
            <span className="hidden sm:inline">選択</span>
          </Button>
        )}
        {newTripSlot}
      </div>
    </div>
  );
}
