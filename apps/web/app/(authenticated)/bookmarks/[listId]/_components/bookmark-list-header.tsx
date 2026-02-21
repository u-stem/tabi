"use client";

import type { BookmarkListResponse } from "@sugara/shared";
import { MAX_BOOKMARKS_PER_LIST } from "@sugara/shared";
import { CheckSquare, Copy, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";

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
}: {
  list: BookmarkListResponse;
  bookmarkCount: number;
  online: boolean;
  sel: Selection;
  listOps: ListOps;
  bmOps: BmOps;
}) {
  const isMobile = useIsMobile();
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
          {list.visibility === "public"
            ? "公開"
            : list.visibility === "friends_only"
              ? "フレンド限定"
              : "非公開"}
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
        <div className="mt-3 flex select-none items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={sel.exit}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium">{sel.selectedIds.size}件選択中</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={sel.selectedIds.size === bookmarkCount ? sel.deselectAll : sel.selectAll}
            disabled={sel.batchLoading}
          >
            {sel.selectedIds.size === bookmarkCount ? "全解除" : "全選択"}
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={sel.handleBatchDuplicate}>
                  <Copy />
                  複製
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => sel.setBatchDeleteOpen(true)}
                >
                  <Trash2 />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 justify-end">
          {bookmarkCount > 0 && online && (
            <Button variant="outline" size="sm" onClick={sel.enter}>
              <CheckSquare className="h-4 w-4" />
              選択
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
