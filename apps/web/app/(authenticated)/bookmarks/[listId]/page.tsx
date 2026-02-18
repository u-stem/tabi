"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  type BookmarkListResponse,
  type BookmarkResponse,
  MAX_BOOKMARKS_PER_LIST,
} from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { SELECTED_RING } from "@/lib/colors";
import { pageTitle } from "@/lib/constants";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useBookmarkListOperations } from "@/lib/hooks/use-bookmark-list-operations";
import { useBookmarkOperations } from "@/lib/hooks/use-bookmark-operations";
import { useBookmarkSelection } from "@/lib/hooks/use-bookmark-selection";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  AddBookmarkDialog,
  BatchDeleteDialog,
  DeleteBookmarkDialog,
  DeleteListDialog,
  EditBookmarkDialog,
  EditListDialog,
} from "./_components/bookmark-dialogs";
import { BookmarkListHeader } from "./_components/bookmark-list-header";
import { BookmarkItemContent, SortableBookmarkItem } from "./_components/sortable-bookmark-item";

export default function BookmarkListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const [localBookmarks, setLocalBookmarks] = useState<BookmarkResponse[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const {
    data: lists = [],
    isLoading: listsLoading,
    error: listsError,
  } = useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: () => api<BookmarkListResponse[]>("/api/bookmark-lists"),
  });
  useAuthRedirect(listsError);

  const list = lists.find((l) => l.id === listId) ?? null;

  const { data: bookmarks = [], isLoading: bookmarksLoading } = useQuery({
    queryKey: queryKeys.bookmarks.list(listId),
    queryFn: () => api<BookmarkResponse[]>(`/api/bookmark-lists/${listId}/bookmarks`),
    enabled: listId !== undefined,
  });

  const showSkeleton = useDelayedLoading(listsLoading);

  useEffect(() => {
    setLocalBookmarks((prev) => {
      if (prev.length === bookmarks.length && prev.every((b, i) => b === bookmarks[i])) {
        return prev;
      }
      return bookmarks;
    });
  }, [bookmarks]);

  useEffect(() => {
    document.title = pageTitle(list ? list.name : "ブックマーク");
  }, [list]);

  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.lists() });

  const invalidateBookmarks = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.list(listId) });

  const bookmarkIds = useMemo(() => localBookmarks.map((bm) => bm.id), [localBookmarks]);

  const sel = useBookmarkSelection({
    listId,
    bookmarkIds,
    invalidateBookmarks,
    invalidateLists,
  });

  const listOps = useBookmarkListOperations({
    listId,
    invalidateLists,
    onDeleted: () => router.push("/bookmarks"),
  });

  const bmOps = useBookmarkOperations({
    listId,
    bookmarkCount: bookmarks.length,
    maxBookmarks: MAX_BOOKMARKS_PER_LIST,
    invalidateBookmarks,
    invalidateLists,
  });

  // -- Drag and drop --

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localBookmarks.findIndex((bm) => bm.id === active.id);
    const newIndex = localBookmarks.findIndex((bm) => bm.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(localBookmarks, oldIndex, newIndex);
    const snapshot = localBookmarks;
    setLocalBookmarks(reordered);

    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ orderedIds: reordered.map((bm) => bm.id) }),
      });
    } catch {
      setLocalBookmarks(snapshot);
      toast.error(MSG.BOOKMARK_REORDER_FAILED);
    }
  }

  // -- Loading --

  if (listsLoading && !showSkeleton) return <div />;

  if (showSkeleton) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-32" />
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="mt-8 text-center">
        <p className="text-muted-foreground">リストが見つかりません</p>
        <Button variant="outline" size="sm" className="mt-4" asChild>
          <Link href="/bookmarks">ブックマーク一覧に戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 mx-auto max-w-2xl">
      <BookmarkListHeader
        list={list}
        bookmarkCount={bookmarks.length}
        online={online}
        sel={sel}
        listOps={listOps}
        bmOps={bmOps}
      />

      {/* Bookmark list */}
      <div>
        {bookmarksLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : localBookmarks.length === 0 ? (
          <p className="mt-8 text-center text-muted-foreground">
            まだブックマークがありません。追加からブックマークを登録してみましょう
          </p>
        ) : sel.selectionMode ? (
          <div className="space-y-3">
            {localBookmarks.map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => sel.toggle(bm.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border bg-card px-3 py-2 text-left shadow-sm",
                  sel.selectedIds.has(bm.id) && SELECTED_RING,
                )}
              >
                <div className="flex shrink-0 items-center pt-0.5">
                  <SelectionIndicator checked={sel.selectedIds.has(bm.id)} />
                </div>
                <BookmarkItemContent bm={bm} />
              </button>
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localBookmarks.map((bm) => bm.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {localBookmarks.map((bm) => (
                  <SortableBookmarkItem
                    key={bm.id}
                    bm={bm}
                    onEdit={bmOps.openEdit}
                    onDelete={bmOps.setDeletingBookmark}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <EditListDialog listOps={listOps} />
      <AddBookmarkDialog bmOps={bmOps} listName={list.name} />
      <EditBookmarkDialog bmOps={bmOps} />
      <DeleteListDialog listOps={listOps} listName={list.name} />
      <DeleteBookmarkDialog bmOps={bmOps} />
      <BatchDeleteDialog sel={sel} />
    </div>
  );
}
