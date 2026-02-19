"use client";

import type { BookmarkListResponse, BookmarkResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, ExternalLink, Plus, SquareMousePointer, StickyNote, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { isSafeUrl, stripProtocol } from "@/lib/format";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type BookmarkPanelProps = {
  tripId: string;
  disabled?: boolean;
  onCandidateAdded: () => void;
};

export function BookmarkPanel({ tripId, disabled, onCandidateAdded }: BookmarkPanelProps) {
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmIds, setConfirmIds] = useState<string[]>([]);

  const { data: lists = [], isLoading: listsLoading } = useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: () => api<BookmarkListResponse[]>("/api/bookmark-lists"),
  });

  const { data: bookmarks = [], isLoading: bookmarksLoading } = useQuery({
    queryKey: queryKeys.bookmarks.list(selectedListId),
    queryFn: () => api<BookmarkResponse[]>(`/api/bookmark-lists/${selectedListId}/bookmarks`),
    enabled: !!selectedListId,
  });

  // Auto-select first list
  useEffect(() => {
    if (!selectedListId && lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
  }, [selectedListId, lists]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(bookmarks.map((bm) => bm.id)));
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  async function addToCandidates(bookmarkIds: string[]) {
    if (bookmarkIds.length === 0) return;
    setLoading(true);
    try {
      await api(`/api/trips/${tripId}/candidates/from-bookmarks`, {
        method: "POST",
        body: JSON.stringify({ bookmarkIds }),
      });
      toast.success(MSG.BOOKMARK_SAVED_TO_CANDIDATES(bookmarkIds.length));
      setConfirmIds([]);
      exitSelection();
      onCandidateAdded();
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_SAVE_TO_CANDIDATES_FAILED));
    } finally {
      setLoading(false);
    }
  }

  if (listsLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">ブックマークリストがありません</p>
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-3">
      {selectionMode ? (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={selectAll}>
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">全選択</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedCount === 0}
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">解除</span>
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={() => setConfirmIds(Array.from(selectedIds))}
            disabled={selectedCount === 0 || loading}
          >
            <Plus className="h-4 w-4" />
            {loading ? "追加中..." : "候補に追加"}
          </Button>
          <Button variant="outline" size="sm" onClick={exitSelection}>
            キャンセル
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <Select
            value={selectedListId}
            onValueChange={(v) => {
              exitSelection();
              setSelectedListId(v);
            }}
          >
            <SelectTrigger className="h-8 min-w-0 flex-1">
              <SelectValue placeholder="リストを選択" />
            </SelectTrigger>
            <SelectContent>
              {lists.map((list) => (
                <SelectItem key={list.id} value={list.id}>
                  {list.name} ({list.bookmarkCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!disabled && bookmarks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setSelectionMode(true)}
            >
              <SquareMousePointer className="h-4 w-4" />
              選択
            </Button>
          )}
        </div>
      )}

      {bookmarksLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">ブックマークがありません</p>
      ) : (
        <div className="space-y-2">
          {bookmarks.map((bm) => {
            const urls = bm.urls ?? [];

            if (selectionMode) {
              return (
                <button
                  key={bm.id}
                  type="button"
                  onClick={() => toggleSelect(bm.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md border p-2 text-left transition-colors cursor-pointer hover:bg-accent/50",
                    selectedIds.has(bm.id) && "ring-2 ring-ring",
                  )}
                >
                  <div className="flex shrink-0 items-center pt-0.5">
                    <SelectionIndicator checked={selectedIds.has(bm.id)} />
                  </div>
                  <BookmarkContent name={bm.name} urls={urls} memo={bm.memo} selectable />
                </button>
              );
            }

            return (
              <div key={bm.id} className="rounded-md border p-2">
                <BookmarkContent name={bm.name} urls={urls} memo={bm.memo} />
              </div>
            );
          })}
        </div>
      )}
      <AlertDialog
        open={confirmIds.length > 0}
        onOpenChange={(open) => {
          if (!open) setConfirmIds([]);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmIds.length}件を候補に追加しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              選択した{confirmIds.length}件のブックマークを旅行の候補に追加します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={() => addToCandidates(confirmIds)} disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "追加中..." : "追加する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BookmarkContent({
  name,
  urls,
  memo,
  selectable,
}: {
  name: string;
  urls: string[];
  memo?: string | null;
  selectable?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium">{name}</p>
      {urls.length > 0 &&
        urls.filter(isSafeUrl).map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-0.5 flex w-fit max-w-full items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400",
              selectable && "pointer-events-none",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{stripProtocol(url)}</span>
          </a>
        ))}
      {memo && (
        <div className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
          <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
          <p className="line-clamp-2 whitespace-pre-line">{memo}</p>
        </div>
      )}
    </div>
  );
}
