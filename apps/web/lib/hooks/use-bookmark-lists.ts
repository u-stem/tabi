import type { BookmarkListResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useBookmarkListSelection } from "@/lib/hooks/use-bookmark-list-selection";
import { queryKeys } from "@/lib/query-keys";

export type VisibilityFilter = "all" | "public" | "friends_only" | "private";

export type UseBookmarkListsReturn = {
  bookmarkLists: BookmarkListResponse[];
  filteredBookmarkLists: BookmarkListResponse[];
  isLoading: boolean;
  error: Error | null;
  visibilityFilter: VisibilityFilter;
  setVisibilityFilter: (filter: VisibilityFilter) => void;
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  invalidateBookmarkLists: () => void;
  sel: ReturnType<typeof useBookmarkListSelection>;
};

export function useBookmarkLists(isGuest: boolean): UseBookmarkListsReturn {
  const queryClient = useQueryClient();

  const {
    data: bookmarkLists = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: () => api<BookmarkListResponse[]>("/api/bookmark-lists"),
    enabled: !isGuest,
  });
  useAuthRedirect(error);

  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const invalidateBookmarkLists = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.bookmarks.lists() });

  const filteredBookmarkLists = useMemo(() => {
    if (visibilityFilter === "all") return bookmarkLists;
    return bookmarkLists.filter((l) => l.visibility === visibilityFilter);
  }, [bookmarkLists, visibilityFilter]);

  const sel = useBookmarkListSelection({
    listIds: filteredBookmarkLists.map((l) => l.id),
    invalidateLists: invalidateBookmarkLists,
  });

  // Prune selected IDs when filtered list changes
  useEffect(() => {
    if (!sel.selectionMode) return;
    const visibleIds = new Set(filteredBookmarkLists.map((l) => l.id));
    const pruned = [...sel.selectedIds].filter((id) => visibleIds.has(id));
    if (pruned.length < sel.selectedIds.size) {
      sel.select(pruned);
    }
  }, [filteredBookmarkLists, sel.selectionMode, sel.selectedIds]);

  return {
    bookmarkLists,
    filteredBookmarkLists,
    isLoading,
    error,
    visibilityFilter,
    setVisibilityFilter,
    createDialogOpen,
    setCreateDialogOpen,
    invalidateBookmarkLists,
    sel,
  };
}
