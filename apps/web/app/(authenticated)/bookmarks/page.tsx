"use client";

import { type BookmarkListResponse, MAX_BOOKMARK_LISTS_PER_USER } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Copy, Plus, SquareMousePointer, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { toast } from "sonner";
import { BookmarkListCard } from "@/components/bookmark-list-card";
import { CreateBookmarkListDialog } from "@/components/create-bookmark-list-dialog";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
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
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
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

  const {
    data: bookmarkLists = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: () => api<BookmarkListResponse[]>("/api/bookmark-lists"),
  });
  useAuthRedirect(error);

  useEffect(() => {
    document.title = "ブックマーク - sugara";
  }, []);

  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

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
  useHotkeys("n", () => setCreateDialogOpen(true), { preventDefault: true });

  const invalidateBookmarkLists = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.lists() });

  const filteredBookmarkLists = useMemo(() => {
    if (visibilityFilter === "all") return bookmarkLists;
    return bookmarkLists.filter((l) => l.visibility === visibilityFilter);
  }, [bookmarkLists, visibilityFilter]);

  useEffect(() => {
    if (!selectionMode) return;
    const visibleIds = new Set(filteredBookmarkLists.map((l) => l.id));
    setSelectedIds((prev) => {
      const pruned = new Set([...prev].filter((id) => visibleIds.has(id)));
      if (pruned.size === prev.size) return prev;
      return pruned;
    });
  }, [filteredBookmarkLists, selectionMode]);

  function handleSelectionModeChange(mode: boolean) {
    setSelectionMode(mode);
    if (!mode) {
      setSelectedIds(new Set());
    }
  }

  function handleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredBookmarkLists.map((l) => l.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds];
    setDeleting(true);

    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/bookmark-lists/${id}`, { method: "DELETE" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    if (succeeded > 0) {
      await invalidateBookmarkLists();
    }

    if (failed > 0) {
      toast.error(MSG.BOOKMARK_LIST_BULK_DELETE_FAILED(failed));
    } else {
      toast.success(MSG.BOOKMARK_LIST_BULK_DELETED(succeeded));
    }

    setSelectedIds(new Set());
    setSelectionMode(false);
    setDeleting(false);
  }

  async function handleDuplicateSelected() {
    const ids = [...selectedIds];
    setDuplicating(true);

    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/bookmark-lists/${id}/duplicate`, { method: "POST" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    if (succeeded > 0) {
      await invalidateBookmarkLists();
    }

    if (failed > 0) {
      toast.error(MSG.BOOKMARK_LIST_BULK_DUPLICATE_FAILED(failed));
    } else {
      toast.success(MSG.BOOKMARK_LIST_BULK_DUPLICATED(succeeded));
    }

    setSelectedIds(new Set());
    setSelectionMode(false);
    setDuplicating(false);
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
            {selectionMode ? (
              <div
                role="toolbar"
                aria-label="選択操作"
                className="flex flex-wrap items-center gap-2"
              >
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={deleting || duplicating}
                  >
                    <CheckCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">全選択</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeselectAll}
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
                    onClick={handleDuplicateSelected}
                    disabled={selectedIds.size === 0 || deleting || duplicating}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">{duplicating ? "複製中..." : "複製"}</span>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={selectedIds.size === 0 || deleting || duplicating}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">{deleting ? "削除中..." : "削除"}</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {selectedIds.size}件のリストを削除しますか？
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          選択したリストとすべてのブックマークが削除されます。この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteSelected}
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
                    onClick={() => handleSelectionModeChange(false)}
                    disabled={deleting || duplicating}
                  >
                    キャンセル
                  </Button>
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
                    onClick={() => handleSelectionModeChange(true)}
                    disabled={!online || filteredBookmarkLists.length === 0}
                  >
                    <SquareMousePointer className="h-4 w-4" />
                    <span className="hidden sm:inline">選択</span>
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
                  selectable={selectionMode}
                  selected={selectedIds.has(list.id)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          )}
        </>
      )}
      <CreateBookmarkListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={invalidateBookmarkLists}
      />
    </>
  );
}
