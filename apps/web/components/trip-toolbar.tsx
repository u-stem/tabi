"use client";

import type { TripStatus } from "@sugara/shared";
import { STATUS_LABELS } from "@sugara/shared";
import {
  CalendarCheck,
  CalendarClock,
  CheckCircle,
  Clock,
  Copy,
  ListFilter,
  MoreHorizontal,
  PenLine,
  Plane,
  PlaneTakeoff,
  SquareMousePointer,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { ActionSheet } from "@/components/action-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMobile } from "@/lib/hooks/use-is-mobile";

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
  hideDelete?: boolean;
  hideStatusFilter?: boolean;
  hideSortKey?: boolean;
  deleteLabel?: string;
};

const STATUS_ICONS: Record<string, ReactNode> = {
  scheduling: <CalendarClock className="h-4 w-4" />,
  draft: <PenLine className="h-4 w-4" />,
  planned: <CalendarCheck className="h-4 w-4" />,
  active: <Plane className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
};

const statusFilters: { value: StatusFilter; label: string; icon: ReactNode }[] = [
  { value: "all", label: "すべて", icon: <ListFilter className="h-4 w-4" /> },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value: value as TripStatus,
    label,
    icon: STATUS_ICONS[value],
  })),
];

const sortOptions: { value: SortKey; label: string; icon: ReactNode }[] = [
  { value: "updatedAt", label: "更新日", icon: <Clock className="h-4 w-4" /> },
  { value: "startDate", label: "出発日", icon: <PlaneTakeoff className="h-4 w-4" /> },
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
  hideDelete,
  hideStatusFilter,
  hideSortKey,
  deleteLabel = "旅行",
}: TripToolbarProps) {
  const isMobile = useMobile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const currentStatusLabel = statusFilters.find((f) => f.value === statusFilter)?.label ?? "すべて";
  const currentSortLabel = sortOptions.find((s) => s.value === sortKey)?.label ?? "更新日";

  if (selectionMode) {
    return (
      <>
        <div className="flex h-8 select-none items-center gap-1.5 rounded-lg bg-muted px-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onSelectionModeChange?.(false)}
            disabled={deleting || duplicating}
            aria-label="選択を終了"
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="whitespace-nowrap text-xs font-medium">{selectedCount}件選択中</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
            disabled={deleting || duplicating}
          >
            {selectedCount === totalCount ? "全解除" : "全選択"}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            {isMobile ? (
              <>
                {!hideDuplicate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    disabled={selectedCount === 0 || deleting || duplicating}
                    onClick={onDuplicateSelected}
                  >
                    <Copy className="h-4 w-4" />
                    複製
                  </Button>
                )}
                {!hideDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-destructive"
                    disabled={selectedCount === 0 || deleting || duplicating}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    削除
                  </Button>
                )}
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={selectedCount === 0 || deleting || duplicating}
                    aria-label="選択操作メニュー"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!hideDuplicate && (
                    <DropdownMenuItem onClick={onDuplicateSelected}>
                      <Copy />
                      複製
                    </DropdownMenuItem>
                  )}
                  {!hideDelete && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                      削除
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {!hideDelete && (
          <ResponsiveAlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <ResponsiveAlertDialogContent>
              <ResponsiveAlertDialogHeader>
                <ResponsiveAlertDialogTitle>
                  {selectedCount}件の{deleteLabel}を削除しますか？
                </ResponsiveAlertDialogTitle>
                <ResponsiveAlertDialogDescription>
                  選択した{deleteLabel}が削除されます。この操作は取り消せません。
                </ResponsiveAlertDialogDescription>
              </ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogFooter>
                <ResponsiveAlertDialogCancel>
                  <X className="h-4 w-4" />
                  キャンセル
                </ResponsiveAlertDialogCancel>
                <ResponsiveAlertDialogDestructiveAction onClick={onDeleteSelected}>
                  <Trash2 className="h-4 w-4" />
                  削除する
                </ResponsiveAlertDialogDestructiveAction>
              </ResponsiveAlertDialogFooter>
            </ResponsiveAlertDialogContent>
          </ResponsiveAlertDialog>
        )}
      </>
    );
  }

  if (isMobile) {
    return (
      <div role="toolbar" aria-label="旅行フィルター" className="flex flex-col gap-2">
        <Input
          ref={searchInputRef}
          id="trips-search"
          name="search"
          type="search"
          placeholder="検索..."
          aria-label="旅行を検索"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full"
        />
        <div className="flex gap-2">
          {!hideStatusFilter && (
            <>
              <button
                type="button"
                aria-label="ステータスで絞り込み"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setStatusSheetOpen(true);
                }}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border bg-background px-2 text-xs"
              >
                {statusFilters.find((f) => f.value === statusFilter)?.icon}
                {currentStatusLabel}
              </button>
              <ActionSheet
                open={statusSheetOpen}
                onOpenChange={setStatusSheetOpen}
                actions={statusFilters.map((f) => ({
                  label: f.label,
                  icon: f.icon,
                  onClick: () => onStatusFilterChange(f.value),
                }))}
              />
            </>
          )}
          {!hideSortKey && (
            <button
              type="button"
              aria-label="並び替え"
              onClick={() => onSortKeyChange(sortKey === "updatedAt" ? "startDate" : "updatedAt")}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border bg-background px-2 text-xs"
            >
              {sortOptions.find((s) => s.value === sortKey)?.icon}
              {currentSortLabel}
            </button>
          )}
          {onSelectionModeChange && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 flex-1"
              onClick={() => onSelectionModeChange(true)}
              disabled={disabled || totalCount === 0}
              aria-label="選択モード"
            >
              <SquareMousePointer className="h-4 w-4" />
              選択
            </Button>
          )}
          {newTripSlot && <div className="shrink-0">{newTripSlot}</div>}
        </div>
      </div>
    );
  }

  return (
    <div role="toolbar" aria-label="旅行フィルター" className="flex flex-wrap items-center gap-2">
      {/* Takes full row on narrow viewports, fixed width on sm+ */}
      <Input
        ref={searchInputRef}
        id="trips-search"
        name="search"
        type="search"
        placeholder="検索..."
        aria-label="旅行を検索"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-full min-w-0 sm:w-40 sm:flex-none"
      />
      {!hideStatusFilter && (
        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
          <SelectTrigger
            className="h-8 flex-1 text-xs sm:w-[120px] sm:flex-none"
            aria-label="ステータスで絞り込み"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                <span className="flex items-center gap-2">
                  {f.icon}
                  {f.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {!hideSortKey && (
        <button
          type="button"
          aria-label="並び替え"
          onClick={() => onSortKeyChange(sortKey === "updatedAt" ? "startDate" : "updatedAt")}
          className="flex h-8 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md border bg-background px-2.5 text-xs sm:flex-none"
        >
          {sortOptions.find((s) => s.value === sortKey)?.icon}
          {currentSortLabel}
        </button>
      )}
      {onSelectionModeChange && (
        <div className="shrink-0 sm:ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3"
            onClick={() => onSelectionModeChange(true)}
            disabled={disabled || totalCount === 0}
            aria-label="選択モード"
          >
            <SquareMousePointer className="h-4 w-4" />
            選択
            <span className="hidden text-xs text-muted-foreground lg:inline">(S)</span>
          </Button>
        </div>
      )}
      {newTripSlot && <div className="shrink-0">{newTripSlot}</div>}
    </div>
  );
}
