"use client";

import { type BookmarkListResponse, MAX_BOOKMARK_LISTS_PER_USER } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Copy, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useBookmarkListSelection } from "@/lib/hooks/use-bookmark-list-selection";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { isDialogOpen } from "@/lib/hotkeys";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";

type VisibilityFilter = "all" | "public" | "friends_only" | "private";

const visibilityFilters: { value: VisibilityFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "public", label: "公開" },
  { value: "friends_only", label: "フレンド限定" },
  { value: "private", label: "非公開" },
];

export default function BookmarksPage() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);

  const {
    data: bookmarkLists = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: () => api<BookmarkListResponse[]>("/api/bookmark-lists"),
    enabled: !isGuest,
  });
  useAuthRedirect(error);

  useEffect(() => {
    document.title = pageTitle("ブックマーク");
  }, []);

  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
  const showSkeleton = useDelayedLoading(isLoading);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });
  useHotkeys(
    "n",
    () => {
      if (!isDialogOpen()) setCreateDialogOpen(true);
    },
    { preventDefault: true },
  );

  const invalidateBookmarkLists = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.lists() });

  const filteredBookmarkLists = useMemo(() => {
    if (visibilityFilter === "all") return bookmarkLists;
    return bookmarkLists.filter((l) => l.visibility === visibilityFilter);
  }, [bookmarkLists, visibilityFilter]);

  const sel = useBookmarkListSelection({
    listIds: filteredBookmarkLists.map((l) => l.id),
    invalidateLists: invalidateBookmarkLists,
  });

  // Prune selected IDs when filtered list changes
  useEffect(() => {
    if (!sel.selectionMode) return;
    const visibleIds = new Set(filteredBookmarkLists.map((l) => l.id));
    const currentIds = [...sel.selectedIds];
    const pruned = currentIds.filter((id) => visibleIds.has(id));
    if (pruned.length < currentIds.length) {
      sel.deselectAll();
      for (const id of pruned) sel.toggle(id);
    }
  }, [filteredBookmarkLists, sel.selectionMode]);

  if (isGuest) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{MSG.AUTH_GUEST_FEATURE_UNAVAILABLE}</p>
        </div>
      </div>
    );
  }

  if (isLoading && !showSkeleton) return <div />;

  return (
    <>
      {showSkeleton ? (
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
              <div key={key} className="rounded-xl border bg-card shadow">
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
      ) : error ? (
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
      ) : (
        <>
          <div className="mt-4">
            {sel.selectionMode ? (
              <div className="flex select-none items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={sel.exit}
                  disabled={sel.batchLoading}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-medium">{sel.selectedIds.size}件選択中</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
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
              <div className="flex items-center gap-2">
                <Select
                  value={visibilityFilter}
                  onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}
                >
                  <SelectTrigger className="h-8 w-[100px] text-xs" aria-label="公開状態で絞り込み">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {visibilityFilters.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
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
                    <CheckSquare className="h-4 w-4" />
                    選択
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button
                          size="sm"
                          disabled={
                            !online || bookmarkLists.length >= MAX_BOOKMARK_LISTS_PER_USER
                          }
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
            <p className="mt-8 text-center text-muted-foreground">
              まだリストがありません。新規作成からブックマークリストを作成してみましょう
            </p>
          ) : filteredBookmarkLists.length === 0 ? (
            <p className="mt-8 text-center text-muted-foreground">
              条件に一致するリストがありません
            </p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBookmarkLists.map((list) => (
                <BookmarkListCard
                  key={list.id}
                  {...list}
                  selectable={sel.selectionMode}
                  selected={sel.selectedIds.has(list.id)}
                  onSelect={sel.toggle}
                />
              ))}
            </div>
          )}
        </>
      )}
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
            <ResponsiveAlertDialogCancel>キャンセル</ResponsiveAlertDialogCancel>
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
