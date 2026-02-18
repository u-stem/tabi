import type { BookmarkResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type UseBookmarkOperationsArgs = {
  listId: string;
  bookmarkCount: number;
  maxBookmarks: number;
  invalidateBookmarks: () => void;
  invalidateLists: () => void;
};

export function useBookmarkOperations({
  listId,
  bookmarkCount,
  maxBookmarks,
  invalidateBookmarks,
  invalidateLists,
}: UseBookmarkOperationsArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.bookmarks.list(listId);

  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<BookmarkResponse | null>(null);
  const [deletingBookmark, setDeletingBookmark] = useState<BookmarkResponse | null>(null);
  const [bookmarkName, setBookmarkName] = useState("");
  const [bookmarkMemo, setBookmarkMemo] = useState("");
  const [bookmarkUrls, setBookmarkUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setBookmarkName("");
    setBookmarkMemo("");
    setBookmarkUrls([]);
  }

  function openAdd() {
    resetForm();
    setAddBookmarkOpen(true);
  }

  function openEdit(bm: BookmarkResponse) {
    setBookmarkName(bm.name);
    setBookmarkMemo(bm.memo ?? "");
    setBookmarkUrls(bm.urls ?? []);
    setEditingBookmark(bm);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = bookmarkName.trim();
    if (!trimmed) return;
    if (bookmarkCount >= maxBookmarks) {
      toast.error(MSG.LIMIT_BOOKMARKS);
      return;
    }
    setSubmitting(true);
    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks`, {
        method: "POST",
        body: JSON.stringify({
          name: trimmed,
          memo: bookmarkMemo.trim() || undefined,
          urls: bookmarkUrls.filter((u) => u.trim()),
        }),
      });
      toast.success(MSG.BOOKMARK_ADDED);
      resetForm();
      setAddBookmarkOpen(false);
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_ADD_FAILED));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBookmark) return;
    const trimmed = bookmarkName.trim();
    if (!trimmed) return;

    const updatedFields = {
      name: trimmed,
      memo: bookmarkMemo.trim() || null,
      urls: bookmarkUrls.filter((u) => u.trim()),
    };

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<BookmarkResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.map((b) => (b.id !== editingBookmark.id ? b : { ...b, ...updatedFields })),
      );
    }
    toast.success(MSG.BOOKMARK_UPDATED);
    resetForm();
    setEditingBookmark(null);

    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/${editingBookmark.id}`, {
        method: "PATCH",
        body: JSON.stringify(updatedFields),
      });
      invalidateBookmarks();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_UPDATE_FAILED));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingBookmark) return;
    const bookmarkId = deletingBookmark.id;

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<BookmarkResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((b) => b.id !== bookmarkId),
      );
    }
    toast.success(MSG.BOOKMARK_DELETED);
    setDeletingBookmark(null);

    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/${bookmarkId}`, {
        method: "DELETE",
      });
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_DELETE_FAILED));
    }
  }

  return {
    addBookmarkOpen,
    setAddBookmarkOpen,
    editingBookmark,
    setEditingBookmark,
    deletingBookmark,
    setDeletingBookmark,
    bookmarkName,
    setBookmarkName,
    bookmarkMemo,
    setBookmarkMemo,
    bookmarkUrls,
    setBookmarkUrls,
    submitting,
    resetForm,
    openAdd,
    openEdit,
    handleAdd,
    handleUpdate,
    handleDelete,
  };
}
