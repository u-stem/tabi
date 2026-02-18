import type { BookmarkResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type UseBookmarkSelectionArgs = {
  listId: string;
  bookmarkIds: string[];
  invalidateBookmarks: () => void;
  invalidateLists: () => void;
};

export function useBookmarkSelection({
  listId,
  bookmarkIds,
  invalidateBookmarks,
  invalidateLists,
}: UseBookmarkSelectionArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.bookmarks.list(listId);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  function enter() {
    setSelectionMode(true);
  }

  function exit() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(bookmarkIds));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBatchLoading(true);
    const count = ids.length;
    const idSet = new Set(ids);

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<BookmarkResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((b) => !idSet.has(b.id)),
      );
    }
    toast.success(MSG.BATCH_DELETED(count));
    exit();

    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/batch-delete`, {
        method: "POST",
        body: JSON.stringify({ bookmarkIds: ids }),
      });
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.BATCH_DELETE_FAILED));
    } finally {
      setBatchLoading(false);
      setBatchDeleteOpen(false);
    }
  }

  async function handleBatchDuplicate() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/batch-duplicate`, {
        method: "POST",
        body: JSON.stringify({ bookmarkIds: ids }),
      });
      toast.success(MSG.BATCH_DUPLICATED(ids.length));
      exit();
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BATCH_DUPLICATE_FAILED));
    } finally {
      setBatchLoading(false);
    }
  }

  return {
    selectionMode,
    selectedIds,
    batchLoading,
    batchDeleteOpen,
    setBatchDeleteOpen,
    enter,
    exit,
    toggle,
    selectAll,
    deselectAll,
    handleBatchDelete,
    handleBatchDuplicate,
  };
}
