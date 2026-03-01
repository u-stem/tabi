import type { BookmarkListResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useBookmarkListSelection } from "@/lib/hooks/use-bookmark-list-selection";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";

export type VisibilityFilter = "all" | "public" | "friends_only" | "private";

export type UseBookmarkListsReturn = {
  bookmarkLists: BookmarkListResponse[];
  filteredBookmarkLists: BookmarkListResponse[];
  isLoading: boolean;
  showSkeleton: boolean;
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
  const showSkeleton = useDelayedLoading(isLoading);

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
    const currentIds = [...sel.selectedIds];
    const pruned = currentIds.filter((id) => visibleIds.has(id));
    if (pruned.length < currentIds.length) {
      sel.deselectAll();
      for (const id of pruned) sel.toggle(id);
    }
  }, [filteredBookmarkLists, sel.selectionMode]);

  return {
    bookmarkLists,
    filteredBookmarkLists,
    isLoading,
    showSkeleton,
    error,
    visibilityFilter,
    setVisibilityFilter,
    createDialogOpen,
    setCreateDialogOpen,
    invalidateBookmarkLists,
    sel,
  };
}
