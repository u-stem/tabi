import type { BookmarkResponse } from "@sugara/shared";
import { useState } from "react";
import { toast } from "sonner";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";

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
    setSubmitting(true);
    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/${editingBookmark.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: trimmed,
          memo: bookmarkMemo.trim() || null,
          urls: bookmarkUrls.filter((u) => u.trim()),
        }),
      });
      toast.success(MSG.BOOKMARK_UPDATED);
      resetForm();
      setEditingBookmark(null);
      invalidateBookmarks();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_UPDATE_FAILED));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletingBookmark) return;
    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/${deletingBookmark.id}`, {
        method: "DELETE",
      });
      toast.success(MSG.BOOKMARK_DELETED);
      setDeletingBookmark(null);
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
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
