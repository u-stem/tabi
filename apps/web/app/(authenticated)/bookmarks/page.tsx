"use client";

import { MAX_BOOKMARK_LISTS_PER_USER, VISIBILITY_LABELS } from "@sugara/shared";
import {
  Copy,
  Globe,
  ListFilter,
  Lock,
  MoreHorizontal,
  Plus,
  SquareMousePointer,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { BookmarkListCard } from "@/components/bookmark-list-card";
import { CreateBookmarkListDialog } from "@/components/create-bookmark-list-dialog";
import { Fab } from "@/components/fab";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useBookmarkLists, type VisibilityFilter } from "@/lib/hooks/use-bookmark-lists";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { isDialogOpen } from "@/lib/hotkeys";
import { MSG } from "@/lib/messages";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";

const visibilityFilters: { value: VisibilityFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "すべて", icon: <ListFilter className="h-4 w-4" /> },
  { value: "public", label: "公開", icon: <Globe className="h-4 w-4" /> },
  {
    value: "friends_only",
    label: VISIBILITY_LABELS.friends_only,
    icon: <Users className="h-4 w-4" />,
  },
  { value: "private", label: VISIBILITY_LABELS.private, icon: <Lock className="h-4 w-4" /> },
];

function BookmarksSkeleton() {
  return (
    <>
      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-8 w-[100px]" />
        <div className="flex items-center gap-2 ml-auto">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
          <div key={key} className="rounded-lg border bg-card shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="p-6 pt-0">
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function BookmarksPage() {
  const online = useOnlineStatus();
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);

  const {
    bookmarkLists,
    filteredBookmarkLists,
    isLoading,
    error,
    visibilityFilter,
    setVisibilityFilter,
    createDialogOpen,
    setCreateDialogOpen,
    invalidateBookmarkLists,
    sel,
  } = useBookmarkLists(isGuest);

  const { open: openShortcutHelp } = useShortcutHelp();
  const shortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: "全般",
        items: [{ key: "n", description: "新規作成" }],
      },
    ],
    [],
  );
  useRegisterShortcuts(shortcuts);

  useEffect(() => {
    document.title = pageTitle("ブックマーク");
  }, []);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });
  useHotkeys(
    "n",
    () => {
      if (!isDialogOpen()) setCreateDialogOpen(true);
    },
    { preventDefault: true },
  );

  if (isGuest) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{MSG.AUTH_GUEST_FEATURE_UNAVAILABLE}</p>
        </div>
      </div>
    );
  }

  const errorFallback = error ? (
    <div className="mt-8 text-center">
      <p className="text-destructive">{MSG.BOOKMARK_LIST_FETCH_FAILED}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => invalidateBookmarkLists()}
      >
        再試行
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <LoadingBoundary
        isLoading={isLoading}
        skeleton={<BookmarksSkeleton />}
        error={error}
        errorFallback={errorFallback}
      >
        <div className="mt-4">
          {sel.selectionMode ? (
            <div className="flex h-8 select-none items-center gap-1.5 rounded-lg bg-muted px-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={sel.exit}
                disabled={sel.batchLoading}
                aria-label="選択を終了"
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium">{sel.selectedIds.size}件選択中</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={
                  sel.selectedIds.size === filteredBookmarkLists.length
                    ? sel.deselectAll
                    : sel.selectAll
                }
                disabled={sel.batchLoading}
              >
                {sel.selectedIds.size === filteredBookmarkLists.length ? "全解除" : "全選択"}
              </Button>
              <div className="ml-auto flex items-center gap-1">
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
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={visibilityFilter}
                onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}
              >
                <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="公開状態で絞り込み">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityFilters.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span className="flex items-center gap-2">
                        {f.icon}
                        {f.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sel.enter}
                  disabled={!online || filteredBookmarkLists.length === 0}
                >
                  <SquareMousePointer className="h-4 w-4" />
                  選択
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        disabled={!online || bookmarkLists.length >= MAX_BOOKMARK_LISTS_PER_USER}
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        新規作成
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {bookmarkLists.length >= MAX_BOOKMARK_LISTS_PER_USER && (
                    <TooltipContent>{MSG.LIMIT_BOOKMARK_LISTS}</TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          )}
        </div>
        {bookmarkLists.length === 0 ? (
          <EmptyState message={MSG.EMPTY_BOOKMARK_LIST} variant="page" />
        ) : filteredBookmarkLists.length === 0 ? (
          <EmptyState message={MSG.EMPTY_BOOKMARK_LIST_FILTER} variant="page" />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBookmarkLists.map((list, index) => (
              <div
                key={list.id}
                className="animate-in fade-in duration-300"
                style={{
                  animationDelay: `${Math.min(index * 50, 300)}ms`,
                  animationFillMode: "both",
                }}
              >
                <BookmarkListCard
                  {...list}
                  selectable={sel.selectionMode}
                  selected={sel.selectedIds.has(list.id)}
                  onSelect={sel.toggle}
                />
              </div>
            ))}
          </div>
        )}
      </LoadingBoundary>
      <ResponsiveAlertDialog open={sel.batchDeleteOpen} onOpenChange={sel.setBatchDeleteOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              {sel.selectedIds.size}件のリストを削除しますか？
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              選択したリストとすべてのブックマークが削除されます。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              キャンセル
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction onClick={sel.handleBatchDelete}>
              <Trash2 className="h-4 w-4" />
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
      <CreateBookmarkListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={invalidateBookmarkLists}
      />
      <Fab
        onClick={() => setCreateDialogOpen(true)}
        label="リストを新規作成"
        hidden={!online || sel.selectionMode}
      />
    </>
  );
}
