import type { BookmarkListResponse, BookmarkListVisibility } from "@sugara/shared";
import { useState } from "react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";

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
  const [editingList, setEditingList] = useState(false);
  const [deletingList, setDeletingList] = useState(false);
  const [editListName, setEditListName] = useState("");
  const [editListVisibility, setEditListVisibility] = useState<BookmarkListVisibility>("private");
  const [submitting, setSubmitting] = useState(false);

  function openEdit(list: BookmarkListResponse) {
    setEditListName(list.name);
    setEditListVisibility(list.visibility);
    setEditingList(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editListName.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await api(`/api/bookmark-lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed, visibility: editListVisibility }),
      });
      toast.success(MSG.BOOKMARK_LIST_UPDATED);
      setEditingList(false);
      invalidateLists();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_LIST_UPDATE_FAILED));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    try {
      await api(`/api/bookmark-lists/${listId}`, { method: "DELETE" });
      toast.success(MSG.BOOKMARK_LIST_DELETED);
      setDeletingList(false);
      await invalidateLists();
      onDeleted();
    } catch (err) {
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
    submitting,
    openEdit,
    handleUpdate,
    handleDelete,
  };
}
