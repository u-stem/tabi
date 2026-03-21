"use client";

import { type BookmarkListResponse, MAX_BOOKMARKS_PER_LIST } from "@sugara/shared";
import {
  Copy,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  SquareMousePointer,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActionSheet } from "@/components/action-sheet";
import { ItemMenuButton } from "@/components/item-menu-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { useBookmarkListOperations } from "@/lib/hooks/use-bookmark-list-operations";
import type { useBookmarkOperations } from "@/lib/hooks/use-bookmark-operations";
import type { useBookmarkSelection } from "@/lib/hooks/use-bookmark-selection";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

type ListOps = ReturnType<typeof useBookmarkListOperations>;
type BmOps = ReturnType<typeof useBookmarkOperations>;
type Selection = ReturnType<typeof useBookmarkSelection>;

export function BookmarkListHeader({
  list,
  bookmarkCount,
  online,
  sel,
  listOps,
  bmOps,
  reorderMode,
  onReorderModeChange,
}: {
  list: BookmarkListResponse;
  bookmarkCount: number;
  online: boolean;
  sel: Selection;
  listOps: ListOps;
  bmOps: BmOps;
  reorderMode?: boolean;
  onReorderModeChange?: (mode: boolean) => void;
}) {
  const tm = useTranslations("messages");
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  const tlVis = useTranslations("labels.visibility");
  const isMobile = useMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const sheetActions = [
    {
      label: tc("edit"),
      icon: <Pencil className="h-4 w-4" />,
      onClick: () => listOps.openEdit(list),
    },
    {
      label: tc("delete"),
      icon: <Trash2 className="h-4 w-4" />,
      onClick: () => listOps.setDeletingList(true),
      variant: "destructive" as const,
    },
  ];

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="break-words text-2xl font-bold">{list.name}</h1>
        <Badge
          variant={
            list.visibility === "public"
              ? "default"
              : list.visibility === "friends_only"
                ? "secondary"
                : "outline"
          }
          className="text-xs"
        >
          {tlVis(list.visibility)}
        </Badge>
        {isMobile ? (
          <div className="ml-auto">
            <ItemMenuButton
              ariaLabel={tb("listMenu")}
              disabled={!online}
              onClick={() => setSheetOpen(true)}
            />
            <ActionSheet open={sheetOpen} onOpenChange={setSheetOpen} actions={sheetActions} />
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="ml-auto h-8 w-8"
                disabled={!online}
                aria-label={tb("listMenu")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => listOps.openEdit(list)}>
                <Pencil className="h-4 w-4" />
                {tc("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => listOps.setDeletingList(true)}
              >
                <Trash2 className="h-4 w-4" />
                {tc("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {tb("bookmarkCount", { count: list.bookmarkCount })}
      </p>
      {sel.selectionMode ? (
        <div className="mt-3 flex h-8 select-none items-center gap-1.5 rounded-lg bg-muted px-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={sel.exit}
            aria-label={tc("endSelection")}
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium">
            {tc("selectedCount", { count: sel.selectedIds.size })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={sel.selectedIds.size === bookmarkCount ? sel.deselectAll : sel.selectAll}
            disabled={sel.batchLoading}
          >
            {sel.selectedIds.size === bookmarkCount ? tc("deselectAll") : tc("selectAll")}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            {isMobile ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                  onClick={sel.handleBatchDuplicate}
                >
                  <Copy className="h-4 w-4" />
                  {tc("duplicate")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive"
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                  onClick={() => sel.setBatchDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {tc("delete")}
                </Button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                    aria-label={tb("selectionMenu")}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={sel.handleBatchDuplicate}>
                    <Copy className="h-4 w-4" />
                    {tc("duplicate")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => sel.setBatchDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {tc("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      ) : reorderMode ? (
        <div className="mt-3 flex h-8 select-none items-center gap-1.5 rounded-lg bg-muted px-1.5">
          <GripVertical className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">{tb("reordering")}</span>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => onReorderModeChange?.(false)}
            >
              {tb("reorderDone")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "mt-3 flex items-center gap-1.5",
            isMobile ? "justify-stretch" : "justify-end",
          )}
        >
          {bookmarkCount > 0 && online && (
            <Button
              variant="outline"
              size="sm"
              className={cn(isMobile && "h-9 flex-1")}
              onClick={() => {
                onReorderModeChange?.(false);
                sel.enter();
              }}
            >
              <SquareMousePointer className="h-4 w-4" />
              {tc("select")}
              <span className="hidden text-xs text-muted-foreground lg:inline">(S)</span>
            </Button>
          )}
          {isMobile && bookmarkCount > 1 && online && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 flex-1"
              onClick={() => {
                sel.exit();
                onReorderModeChange?.(true);
              }}
            >
              <GripVertical className="h-4 w-4" />
              {tb("reorder")}
            </Button>
          )}
          {!isMobile && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={bmOps.openAdd}
                    disabled={!online || bookmarkCount >= MAX_BOOKMARKS_PER_LIST}
                  >
                    <Plus className="h-4 w-4" />
                    {tb("add")}
                    <span className="hidden text-xs text-muted-foreground lg:inline">(N)</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {bookmarkCount >= MAX_BOOKMARKS_PER_LIST && (
                <TooltipContent>{tm("limitBookmarks")}</TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
