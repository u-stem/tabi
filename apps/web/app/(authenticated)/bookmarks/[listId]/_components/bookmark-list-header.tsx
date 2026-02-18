"use client";

import type { BookmarkListResponse } from "@sugara/shared";
import { MAX_BOOKMARKS_PER_LIST } from "@sugara/shared";
import {
  CheckCheck,
  CheckSquare,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
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
      </div>
      <p className="text-sm text-muted-foreground">{list.bookmarkCount}件のブックマーク</p>
      {sel.selectionMode ? (
        <div className="mt-3 flex flex-wrap select-none items-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={sel.selectAll}>
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">全選択</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sel.deselectAll}
              disabled={sel.selectedIds.size === 0}
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">選択解除</span>
            </Button>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sel.handleBatchDuplicate}
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">複製</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">複製</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => sel.setBatchDeleteOpen(true)}
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">削除</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="sm:hidden">削除</TooltipContent>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={sel.exit}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 justify-end">
          {bookmarkCount > 0 && online && (
            <Button variant="outline" size="sm" onClick={sel.enter}>
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">選択</span>
            </Button>
          )}
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
        </div>
      )}
    </div>
  );
}
