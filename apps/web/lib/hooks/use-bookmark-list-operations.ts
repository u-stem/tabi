import type { BookmarkListResponse, BookmarkListVisibility } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type UseBookmarkListOperationsArgs = {
  listId: string;
  invalidateLists: () => void;
  onDeleted: () => void;
};

export function useBookmarkListOperations({
  listId,
  invalidateLists,
  onDeleted,
}: UseBookmarkListOperationsArgs) {
  const queryClient = useQueryClient();
  const listsCacheKey = queryKeys.bookmarks.lists();

  const [editingList, setEditingList] = useState(false);
  const [deletingList, setDeletingList] = useState(false);
  const [editListName, setEditListName] = useState("");
  const [editListVisibility, setEditListVisibility] = useState<BookmarkListVisibility>("private");
  function openEdit(list: BookmarkListResponse) {
    setEditListName(list.name);
    setEditListVisibility(list.visibility);
    setEditingList(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editListName.trim();
    if (!trimmed) return;

    await queryClient.cancelQueries({ queryKey: listsCacheKey });
    const prev = queryClient.getQueryData<BookmarkListResponse[]>(listsCacheKey);
    if (prev) {
      queryClient.setQueryData(
        listsCacheKey,
        prev.map((l) =>
          l.id !== listId ? l : { ...l, name: trimmed, visibility: editListVisibility },
        ),
      );
    }
    toast.success(MSG.BOOKMARK_LIST_UPDATED);
    setEditingList(false);

    try {
      await api(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed, visibility: editListVisibility }),
      });
      invalidateLists();
    } catch (err) {
      if (prev) queryClient.setQueryData(listsCacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_LIST_UPDATE_FAILED));
    }
  }

  async function handleDelete() {
    await queryClient.cancelQueries({ queryKey: listsCacheKey });
    const prev = queryClient.getQueryData<BookmarkListResponse[]>(listsCacheKey);
    if (prev) {
      queryClient.setQueryData(
        listsCacheKey,
        prev.filter((l) => l.id !== listId),
      );
    }
    toast.success(MSG.BOOKMARK_LIST_DELETED);
    setDeletingList(false);
    onDeleted();

    try {
      await api(`/api/bookmark-lists/${listId}`, { method: "DELETE" });
      await invalidateLists();
    } catch (err) {
      if (prev) queryClient.setQueryData(listsCacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_LIST_DELETE_FAILED));
    }
  }

  return {
    editingList,
    setEditingList,
    deletingList,
    setDeletingList,
    editListName,
    setEditListName,
    editListVisibility,
    setEditListVisibility,
    openEdit,
    handleUpdate,
    handleDelete,
  };
}
