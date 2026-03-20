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
import { useTranslations } from "next-intl";
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

const statusFilterDefs: { value: StatusFilter; icon: ReactNode }[] = [
  { value: "all", icon: <ListFilter className="h-4 w-4" /> },
  ...Object.keys(STATUS_LABELS).map((value) => ({
    value: value as TripStatus,
    icon: STATUS_ICONS[value],
  })),
];

const sortOptionDefs: { value: SortKey; icon: ReactNode }[] = [
  { value: "updatedAt", icon: <Clock className="h-4 w-4" /> },
  { value: "startDate", icon: <PlaneTakeoff className="h-4 w-4" /> },
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
  deleteLabel,
}: TripToolbarProps) {
  const tc = useTranslations("common");
  const tt = useTranslations("tripToolbar");
  const tl = useTranslations("labels.status");
  const isMobile = useMobile();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const resolvedDeleteLabel = deleteLabel ?? tt("trip");

  const statusFilters = statusFilterDefs.map((f) => ({
    ...f,
    label: f.value === "all" ? tc("all") : tl(f.value),
  }));
  const sortOptions = sortOptionDefs.map((s) => ({
    ...s,
    label: s.value === "updatedAt" ? tt("updatedAt") : tt("startDate"),
  }));

  const currentStatusLabel =
    statusFilters.find((f) => f.value === statusFilter)?.label ?? tc("all");
  const currentSortLabel = sortOptions.find((s) => s.value === sortKey)?.label ?? tt("updatedAt");

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
            aria-label={tc("endSelection")}
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="whitespace-nowrap text-xs font-medium">
            {tc("selectedCount", { count: selectedCount })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={selectedCount === totalCount ? onDeselectAll : onSelectAll}
            disabled={deleting || duplicating}
          >
            {selectedCount === totalCount ? tc("deselectAll") : tc("selectAll")}
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
                    {tc("duplicate")}
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
                    {tc("delete")}
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
                      {tc("duplicate")}
                    </DropdownMenuItem>
                  )}
                  {!hideDelete && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 />
                      {tc("delete")}
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
                  {tc("deleteConfirmTitle", { count: selectedCount, label: resolvedDeleteLabel })}
                </ResponsiveAlertDialogTitle>
                <ResponsiveAlertDialogDescription>
                  {tc("deleteConfirmDescription", { label: resolvedDeleteLabel })}
                </ResponsiveAlertDialogDescription>
              </ResponsiveAlertDialogHeader>
              <ResponsiveAlertDialogFooter>
                <ResponsiveAlertDialogCancel>
                  <X className="h-4 w-4" />
                  {tc("cancel")}
                </ResponsiveAlertDialogCancel>
                <ResponsiveAlertDialogDestructiveAction onClick={onDeleteSelected}>
                  <Trash2 className="h-4 w-4" />
                  {tc("deletConfirm")}
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
      <div role="toolbar" aria-label={tt("tripFilter")} className="flex flex-col gap-2">
        <Input
          ref={searchInputRef}
          id="trips-search"
          name="search"
          type="search"
          placeholder={tc("search")}
          aria-label={tt("searchTrips")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 w-full"
        />
        <div className="flex gap-2">
          {!hideStatusFilter && (
            <>
              <button
                type="button"
                aria-label={tt("filterByStatus")}
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
              aria-label={tc("sort")}
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
              aria-label={tc("selectionMode")}
            >
              <SquareMousePointer className="h-4 w-4" />
              {tc("select")}
            </Button>
          )}
          {newTripSlot && <div className="shrink-0">{newTripSlot}</div>}
        </div>
      </div>
    );
  }

  return (
    <div role="toolbar" aria-label={tt("tripFilter")} className="flex flex-wrap items-center gap-2">
      {/* Takes full row on narrow viewports, fixed width on sm+ */}
      <Input
        ref={searchInputRef}
        id="trips-search"
        name="search"
        type="search"
        placeholder={tc("search")}
        aria-label={tt("searchTrips")}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-full min-w-0 sm:w-40 sm:flex-none"
      />
      {!hideStatusFilter && (
        <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
          <SelectTrigger
            className="h-8 flex-1 text-xs sm:w-[120px] sm:flex-none"
            aria-label={tt("filterByStatus")}
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
          aria-label={tc("sort")}
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
            aria-label={tc("selectionMode")}
          >
            <SquareMousePointer className="h-4 w-4" />
            {tc("select")}
            <span className="hidden text-xs text-muted-foreground lg:inline">(S)</span>
          </Button>
        </div>
      )}
      {newTripSlot && <div className="shrink-0">{newTripSlot}</div>}
    </div>
  );
}
