"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
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
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AddBookmarkDialog,
  BatchDeleteDialog,
  DeleteBookmarkDialog,
  DeleteListDialog,
  EditBookmarkDialog,
  EditListDialog,
} from "@/app/(authenticated)/bookmarks/[listId]/_components/bookmark-dialogs";
import { BookmarkListHeader } from "@/app/(authenticated)/bookmarks/[listId]/_components/bookmark-list-header";
import {
  BookmarkItemContent,
  SortableBookmarkItem,
} from "@/app/(authenticated)/bookmarks/[listId]/_components/sortable-bookmark-item";
import { Fab } from "@/components/fab";
import { ReorderControls } from "@/components/reorder-controls";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { SELECTED_RING } from "@/lib/colors";
import { pageTitle } from "@/lib/constants";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useBookmarkListOperations } from "@/lib/hooks/use-bookmark-list-operations";
import { useBookmarkOperations } from "@/lib/hooks/use-bookmark-operations";
import { useBookmarkSelection } from "@/lib/hooks/use-bookmark-selection";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

function SpBookmarkDetailSkeleton() {
  return (
    <div className="mt-4 mx-auto max-w-2xl">
      {/* Header: title + badge + menu */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="ml-auto h-8 w-8 rounded-md" />
        </div>
        <Skeleton className="mt-1 h-4 w-28" />
        {/* Action buttons */}
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 flex-1 rounded-md" />
        </div>
      </div>
      {/* Bookmark items */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border px-3 py-2 space-y-1.5">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpBookmarkListDetailPage() {
  const tm = useTranslations("messages");
  const tb = useTranslations("bookmark");
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const [localBookmarks, setLocalBookmarks] = useState<BookmarkResponse[]>([]);
  const [reorderMode, setReorderMode] = useState(false);

  // TouchSensor is intentionally omitted: all items are non-draggable on SP,
  // and TouchSensor's 200ms delay would interfere with scroll.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

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

  const isLoading = listsLoading || bookmarksLoading;

  useEffect(() => {
    setLocalBookmarks((prev) => {
      if (prev.length === bookmarks.length && prev.every((b, i) => b === bookmarks[i])) {
        return prev;
      }
      return bookmarks;
    });
  }, [bookmarks]);

  useEffect(() => {
    document.title = pageTitle(list ? list.name : tb("pageTitle"));
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
    onDeleted: () => router.push("/sp/bookmarks"),
  });

  const bmOps = useBookmarkOperations({
    listId,
    bookmarkCount: bookmarks.length,
    maxBookmarks: MAX_BOOKMARKS_PER_LIST,
    invalidateBookmarks,
    invalidateLists,
  });

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
      toast.error(tm("bookmarkReorderFailed"));
    }
  }

  async function moveBookmark(id: string, direction: "up" | "down") {
    const idx = localBookmarks.findIndex((bm) => bm.id === id);
    if (idx === -1) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= localBookmarks.length) return;

    const snapshot = [...localBookmarks];
    const reordered = arrayMove(localBookmarks, idx, newIdx);
    setLocalBookmarks(reordered);

    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ orderedIds: reordered.map((bm) => bm.id) }),
      });
    } catch {
      setLocalBookmarks(snapshot);
      toast.error(tm("bookmarkReorderFailed"));
    }
  }

  return (
    <LoadingBoundary isLoading={isLoading} skeleton={<SpBookmarkDetailSkeleton />}>
      {!list ? (
        <div className="mt-8 text-center">
          <p className="text-muted-foreground">{tb("listNotFound")}</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/sp/bookmarks">{tb("backToList")}</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 mx-auto max-w-2xl">
          <BookmarkListHeader
            list={list}
            bookmarkCount={bookmarks.length}
            online={online}
            sel={sel}
            listOps={listOps}
            bmOps={bmOps}
            reorderMode={reorderMode}
            onReorderModeChange={setReorderMode}
          />

          <div>
            {localBookmarks.length === 0 ? (
              <EmptyState message={tm("emptyBookmark")} variant="page" />
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
            ) : reorderMode ? (
              <div className="space-y-3">
                {localBookmarks.map((bm, idx) => (
                  <div
                    key={bm.id}
                    className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm"
                  >
                    <div className="flex h-5 shrink-0 items-center">
                      <ReorderControls
                        onMoveUp={() => moveBookmark(bm.id, "up")}
                        onMoveDown={() => moveBookmark(bm.id, "down")}
                        isFirst={idx === 0}
                        isLast={idx === localBookmarks.length - 1}
                      />
                    </div>
                    <BookmarkItemContent bm={bm} asLink />
                  </div>
                ))}
              </div>
            ) : (
              // SP: always treat as mobile — disable drag-and-drop, use touch-friendly reorder
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
                        draggable={false}
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
          <Fab
            onClick={bmOps.openAdd}
            label={tb("addBookmark")}
            hidden={!online || sel.selectionMode}
          />
        </div>
      )}
    </LoadingBoundary>
  );
}
