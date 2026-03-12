"use client";

import {
  type BookmarkListResponse,
  MAX_BOOKMARKS_PER_LIST,
  VISIBILITY_LABELS,
} from "@sugara/shared";
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
import { MSG } from "@/lib/messages";
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
  const isMobile = useMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const sheetActions = [
    {
      label: "編集",
      icon: <Pencil className="h-4 w-4" />,
      onClick: () => listOps.openEdit(list),
    },
    {
      label: "削除",
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
          {VISIBILITY_LABELS[list.visibility]}
        </Badge>
        {isMobile ? (
          <div className="ml-auto">
            <ItemMenuButton
              ariaLabel="リストメニュー"
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
                aria-label="リストメニュー"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => listOps.openEdit(list)}>
                <Pencil className="h-4 w-4" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => listOps.setDeletingList(true)}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{list.bookmarkCount}件のブックマーク</p>
      {sel.selectionMode ? (
        <div className="mt-3 flex h-8 select-none items-center gap-1.5 rounded-lg bg-muted px-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={sel.exit}
            aria-label="選択を終了"
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium">{sel.selectedIds.size}件選択中</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={sel.selectedIds.size === bookmarkCount ? sel.deselectAll : sel.selectAll}
            disabled={sel.batchLoading}
          >
            {sel.selectedIds.size === bookmarkCount ? "全解除" : "全選択"}
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
                  複製
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive"
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                  onClick={() => sel.setBatchDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  削除
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
                    aria-label="選択操作メニュー"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={sel.handleBatchDuplicate}>
                    <Copy className="h-4 w-4" />
                    複製
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => sel.setBatchDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    削除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      ) : reorderMode ? (
        <div className="mt-3 flex h-8 select-none items-center gap-1.5 rounded-lg bg-muted px-1.5">
          <GripVertical className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">並び替え中</span>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => onReorderModeChange?.(false)}
            >
              完了
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
              選択
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
              並び替え
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
                    追加
                  </Button>
                </span>
              </TooltipTrigger>
              {bookmarkCount >= MAX_BOOKMARKS_PER_LIST && (
                <TooltipContent>{MSG.LIMIT_BOOKMARKS}</TooltipContent>
              )}
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
