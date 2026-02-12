"use client";

import type { TripStatus } from "@sugara/shared";
import { STATUS_LABELS } from "@sugara/shared";
import { CheckCheck, Copy, SquareMousePointer, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
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
  onSelectionModeChange: (value: boolean) => void;
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
}: TripToolbarProps) {
  if (selectionMode) {
    return (
      <div role="toolbar" aria-label="選択操作" className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onSelectAll}
          disabled={deleting || duplicating}
        >
          <CheckCheck className="h-4 w-4" />
          全選択
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDeselectAll}
          disabled={deleting || duplicating}
        >
          <X className="h-4 w-4" />
          選択解除
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDuplicateSelected}
            disabled={selectedCount === 0 || deleting || duplicating}
          >
            <Copy className="h-4 w-4" />
            {duplicating ? "複製中..." : "複製"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedCount === 0 || deleting || duplicating}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "削除中..." : "削除"}
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
                <AlertDialogAction
                  onClick={onDeleteSelected}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Trash2 className="h-4 w-4" />
                  削除する
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelectionModeChange(false)}
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
        type="search"
        placeholder="検索..."
        aria-label="旅行を検索"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-full sm:w-40"
      />
      <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
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
      <Select value={sortKey} onValueChange={(v) => onSortKeyChange(v as SortKey)}>
        <SelectTrigger className="h-8 w-[100px] text-xs" aria-label="並び替え">
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
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectionModeChange(true)}
          disabled={disabled || totalCount === 0}
        >
          <SquareMousePointer className="h-4 w-4" />
          選択
        </Button>
        {newTripSlot}
      </div>
    </div>
  );
}
