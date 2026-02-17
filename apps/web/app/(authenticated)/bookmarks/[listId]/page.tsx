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
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BOOKMARK_LIST_NAME_MAX_LENGTH,
  BOOKMARK_MEMO_MAX_LENGTH,
  BOOKMARK_NAME_MAX_LENGTH,
  BOOKMARK_URL_MAX_LENGTH,
  type BookmarkListResponse,
  type BookmarkListVisibility,
  type BookmarkResponse,
  MAX_BOOKMARKS_PER_LIST,
  MAX_URLS_PER_BOOKMARK,
} from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCheck,
  CheckSquare,
  Copy,
  ExternalLink,
  Minus,
  MoreHorizontal,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DragHandle } from "@/components/drag-handle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api, getApiErrorMessage } from "@/lib/api";
import { SELECTED_RING } from "@/lib/colors";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export default function BookmarkListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();

  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<BookmarkResponse | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [deletingList, setDeletingList] = useState(false);
  const [deletingBookmark, setDeletingBookmark] = useState<BookmarkResponse | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const [editListName, setEditListName] = useState("");
  const [editListVisibility, setEditListVisibility] = useState<BookmarkListVisibility>("private");
  const [bookmarkName, setBookmarkName] = useState("");
  const [bookmarkMemo, setBookmarkMemo] = useState("");
  const [bookmarkUrls, setBookmarkUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
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
    document.title = list ? `${list.name} - sugara` : "ブックマーク - sugara";
  }, [list]);

  const invalidateLists = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.lists() });

  const invalidateBookmarks = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.list(listId) });

  // -- List CRUD --

  async function handleUpdateList(e: React.FormEvent) {
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

  async function handleDeleteList() {
    try {
      await api(`/api/bookmark-lists/${listId}`, { method: "DELETE" });
      toast.success(MSG.BOOKMARK_LIST_DELETED);
      setDeletingList(false);
      await invalidateLists();
      router.push("/bookmarks");
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_LIST_DELETE_FAILED));
    }
  }

  // -- Bookmark CRUD --

  async function handleAddBookmark(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = bookmarkName.trim();
    if (!trimmed) return;
    if (bookmarks.length >= MAX_BOOKMARKS_PER_LIST) {
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
      resetBookmarkForm();
      setAddBookmarkOpen(false);
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_ADD_FAILED));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateBookmark(e: React.FormEvent) {
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
      resetBookmarkForm();
      setEditingBookmark(null);
      invalidateBookmarks();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_UPDATE_FAILED));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBookmark() {
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

  function resetBookmarkForm() {
    setBookmarkName("");
    setBookmarkMemo("");
    setBookmarkUrls([]);
  }

  function openEditBookmark(bm: BookmarkResponse) {
    setBookmarkName(bm.name);
    setBookmarkMemo(bm.memo ?? "");
    setBookmarkUrls(bm.urls ?? []);
    setEditingBookmark(bm);
  }

  function openAddBookmark() {
    resetBookmarkForm();
    setAddBookmarkOpen(true);
  }

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

  // -- Selection mode --

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(localBookmarks.map((bm) => bm.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function handleBatchDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBatchLoading(true);
    try {
      await api(`/api/bookmark-lists/${listId}/bookmarks/batch-delete`, {
        method: "POST",
        body: JSON.stringify({ bookmarkIds: ids }),
      });
      toast.success(MSG.BATCH_DELETED(ids.length));
      exitSelection();
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
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
      exitSelection();
      invalidateBookmarks();
      invalidateLists();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BATCH_DUPLICATE_FAILED));
    } finally {
      setBatchLoading(false);
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
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-words text-2xl font-bold">{list.name}</h1>
          <Badge
            variant={
              list.visibility === "public"
                ? "default"
                : list.visibility === "friends_only"
                  ? "secondary"
                  : "outline"
            }
            className="text-xs"
          >
            {list.visibility === "public"
              ? "公開"
              : list.visibility === "friends_only"
                ? "フレンド限定"
                : "非公開"}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="ml-auto h-8 w-8" disabled={!online}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setEditListName(list.name);
                  setEditListVisibility(list.visibility);
                  setEditingList(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeletingList(true)}>
                <Trash2 className="h-4 w-4" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-sm text-muted-foreground">{list.bookmarkCount}件のブックマーク</p>
        {selectionMode ? (
          <div className="mt-3 flex flex-wrap select-none items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={selectAll}>
                <CheckCheck className="h-4 w-4" />
                <span className="hidden sm:inline">全選択</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                disabled={selectedIds.size === 0}
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">選択解除</span>
              </Button>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBatchDuplicate}
                    disabled={selectedIds.size === 0 || batchLoading}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="hidden sm:inline">複製</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">複製</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBatchDeleteOpen(true)}
                    disabled={selectedIds.size === 0 || batchLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">削除</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="sm:hidden">削除</TooltipContent>
              </Tooltip>
              <Button variant="outline" size="sm" onClick={exitSelection}>
                キャンセル
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 justify-end">
            {bookmarks.length > 0 && online && (
              <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">選択</span>
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openAddBookmark}
                    disabled={!online || bookmarks.length >= MAX_BOOKMARKS_PER_LIST}
                  >
                    <Plus className="h-4 w-4" />
                    追加
                  </Button>
                </span>
              </TooltipTrigger>
              {bookmarks.length >= MAX_BOOKMARKS_PER_LIST && (
                <TooltipContent>{MSG.LIMIT_BOOKMARKS}</TooltipContent>
              )}
            </Tooltip>
          </div>
        )}
      </div>

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
        ) : selectionMode ? (
          <div className="space-y-3">
            {localBookmarks.map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => toggleSelect(bm.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg border bg-card px-3 py-2 text-left shadow-sm",
                  selectedIds.has(bm.id) && SELECTED_RING,
                )}
              >
                <div className="flex shrink-0 items-center pt-0.5">
                  <SelectionIndicator checked={selectedIds.has(bm.id)} />
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
                    onEdit={openEditBookmark}
                    onDelete={setDeletingBookmark}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Edit list dialog */}
      <Dialog open={editingList} onOpenChange={(v) => !v && setEditingList(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>リストを編集</DialogTitle>
            <DialogDescription>リストの設定を変更します。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateList}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-list-name">リスト名</Label>
                <Input
                  id="edit-list-name"
                  value={editListName}
                  onChange={(e) => setEditListName(e.target.value)}
                  maxLength={BOOKMARK_LIST_NAME_MAX_LENGTH}
                  required
                />
                <p className="text-right text-xs text-muted-foreground">
                  {editListName.length}/{BOOKMARK_LIST_NAME_MAX_LENGTH}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-list-visibility">公開設定</Label>
                <Select
                  value={editListVisibility}
                  onValueChange={(v) => setEditListVisibility(v as BookmarkListVisibility)}
                >
                  <SelectTrigger id="edit-list-visibility" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">非公開</SelectItem>
                    <SelectItem value="friends_only">フレンド限定</SelectItem>
                    <SelectItem value="public">全体公開</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingList(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={submitting || !editListName.trim()}>
                {submitting ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add bookmark dialog */}
      <Dialog
        open={addBookmarkOpen}
        onOpenChange={(v) => {
          if (!v) {
            resetBookmarkForm();
            setAddBookmarkOpen(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ブックマークを追加</DialogTitle>
            <DialogDescription>「{list.name}」にブックマークを追加します。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddBookmark}>
            <BookmarkFormFields
              name={bookmarkName}
              memo={bookmarkMemo}
              urls={bookmarkUrls}
              onNameChange={setBookmarkName}
              onMemoChange={setBookmarkMemo}
              onUrlsChange={setBookmarkUrls}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetBookmarkForm();
                  setAddBookmarkOpen(false);
                }}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={submitting || !bookmarkName.trim()}>
                {submitting ? "追加中..." : "追加"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit bookmark dialog */}
      <Dialog
        open={editingBookmark !== null}
        onOpenChange={(v) => {
          if (!v) {
            resetBookmarkForm();
            setEditingBookmark(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ブックマークを編集</DialogTitle>
            <DialogDescription>ブックマークの内容を変更します。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateBookmark}>
            <BookmarkFormFields
              name={bookmarkName}
              memo={bookmarkMemo}
              urls={bookmarkUrls}
              onNameChange={setBookmarkName}
              onMemoChange={setBookmarkMemo}
              onUrlsChange={setBookmarkUrls}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetBookmarkForm();
                  setEditingBookmark(null);
                }}
              >
                キャンセル
              </Button>
              <Button type="submit" disabled={submitting || !bookmarkName.trim()}>
                {submitting ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete list confirmation */}
      <AlertDialog open={deletingList} onOpenChange={(v) => !v && setDeletingList(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>リストを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{list.name}
              」とそのブックマークがすべて削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteList}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete bookmark confirmation */}
      <AlertDialog
        open={deletingBookmark !== null}
        onOpenChange={(v) => !v && setDeletingBookmark(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ブックマークを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deletingBookmark?.name}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBookmark}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete confirmation */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={(v) => !v && setBatchDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedIds.size}件のブックマークを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              選択したブックマークをすべて削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={batchLoading}
            >
              {batchLoading ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BookmarkItemContent({ bm, asLink }: { bm: BookmarkResponse; asLink?: boolean }) {
  const urls = bm.urls ?? [];
  return (
    <div className="min-w-0 flex-1">
      <span className="break-words font-medium text-sm">{bm.name}</span>
      {urls.length > 0 &&
        urls.map((url) =>
          asLink ? (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            </a>
          ) : (
            <p
              key={url}
              className="mt-1 flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            </p>
          ),
        )}
      {bm.memo && (
        <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
          <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
          <p className="whitespace-pre-line">{bm.memo}</p>
        </div>
      )}
    </div>
  );
}

function SortableBookmarkItem({
  bm,
  onEdit,
  onDelete,
}: {
  bm: BookmarkResponse;
  onEdit: (bm: BookmarkResponse) => void;
  onDelete: (bm: BookmarkResponse) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bm.id,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex shrink-0 items-center pt-0.5">
        <DragHandle attributes={attributes} listeners={listeners} />
      </div>
      <BookmarkItemContent bm={bm} asLink />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`${bm.name}のメニュー`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(bm)}>
            <Pencil className="mr-2 h-3 w-3" />
            編集
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(bm)}>
            <Trash2 className="mr-2 h-3 w-3" />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BookmarkFormFields({
  name,
  memo,
  urls,
  onNameChange,
  onMemoChange,
  onUrlsChange,
}: {
  name: string;
  memo: string;
  urls: string[];
  onNameChange: (v: string) => void;
  onMemoChange: (v: string) => void;
  onUrlsChange: (v: string[]) => void;
}) {
  const displayUrls = urls.length > 0 ? urls : [""];

  // Stable keys for the dynamic URL list to avoid index-based keys
  const nextKeyRef = useRef(displayUrls.length);
  const [urlKeys, setUrlKeys] = useState<number[]>(() => displayUrls.map((_, i) => i));
  const prevLengthRef = useRef(displayUrls.length);

  if (prevLengthRef.current !== displayUrls.length) {
    prevLengthRef.current = displayUrls.length;
    nextKeyRef.current = displayUrls.length;
    setUrlKeys(Array.from({ length: displayUrls.length }, (_, i) => i));
  }

  const addUrlKey = useCallback(() => {
    const key = nextKeyRef.current++;
    setUrlKeys((prev) => [...prev, key]);
  }, []);

  const removeUrlKey = useCallback((index: number) => {
    setUrlKeys((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="bookmark-name">名前</Label>
        <Input
          id="bookmark-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="金閣寺"
          maxLength={BOOKMARK_NAME_MAX_LENGTH}
          required
          autoFocus
        />
        <p className="text-right text-xs text-muted-foreground">
          {name.length}/{BOOKMARK_NAME_MAX_LENGTH}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bookmark-memo">メモ</Label>
        <Textarea
          id="bookmark-memo"
          value={memo}
          onChange={(e) => onMemoChange(e.target.value)}
          placeholder="拝観料 500円"
          rows={3}
          maxLength={BOOKMARK_MEMO_MAX_LENGTH}
        />
        <p className="text-right text-xs text-muted-foreground">
          {memo.length}/{BOOKMARK_MEMO_MAX_LENGTH}
        </p>
      </div>
      <div className="space-y-2">
        <Label>URL</Label>
        {displayUrls.map((url, index) => (
          <div key={urlKeys[index]} className="flex items-center gap-1">
            <Input
              type="url"
              value={url}
              onChange={(e) => {
                const next = [...displayUrls];
                next[index] = e.target.value;
                onUrlsChange(next);
              }}
              placeholder="https://..."
              maxLength={BOOKMARK_URL_MAX_LENGTH}
            />
            {index > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  removeUrlKey(index);
                  onUrlsChange(displayUrls.filter((_, i) => i !== index));
                }}
                aria-label="URL を削除"
              >
                <Minus className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
        {displayUrls.length < MAX_URLS_PER_BOOKMARK && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              addUrlKey();
              onUrlsChange([...displayUrls, ""]);
            }}
          >
            <Plus className="inline h-3 w-3" /> URL を追加
          </button>
        )}
      </div>
    </div>
  );
}
