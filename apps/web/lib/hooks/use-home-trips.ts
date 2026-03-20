import type { TripListItem } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { SortKey, StatusFilter } from "@/components/trip-toolbar";
import { ApiError, api } from "@/lib/api";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { queryKeys } from "@/lib/query-keys";

export type HomeTab = "owned" | "shared";

export type UseHomeTripsReturn = {
  ownedTrips: TripListItem[];
  sharedTrips: TripListItem[];
  isLoading: boolean;
  error: Error | null;
  tab: HomeTab;
  setTab: (tab: HomeTab) => void;
  search: string;
  setSearch: (search: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
  sortKey: SortKey;
  setSortKey: (key: SortKey) => void;
  // Clears selectedIds when mode is set to false
  selectionMode: boolean;
  setSelectionMode: (mode: boolean) => void;
  selectedIds: Set<string>;
  handleSelect: (id: string) => void;
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  deleting: boolean;
  duplicating: boolean;
  handleDeleteSelected: () => Promise<void>;
  handleDuplicateSelected: () => Promise<void>;
  createTripOpen: boolean;
  setCreateTripOpen: (open: boolean) => void;
  baseTrips: TripListItem[];
  filteredTrips: TripListItem[];
  invalidateAll: () => Promise<void>;
};

export function useHomeTrips(): UseHomeTripsReturn {
  const tm = useTranslations("messages");
  const queryClient = useQueryClient();

  const {
    data: ownedTrips = [],
    isLoading: ownedLoading,
    error: ownedError,
  } = useQuery({
    queryKey: queryKeys.trips.owned(),
    queryFn: () => api<TripListItem[]>("/api/trips?scope=owned"),
  });
  useAuthRedirect(ownedError);

  const {
    data: sharedTrips = [],
    isLoading: sharedLoading,
    error: sharedError,
  } = useQuery({
    queryKey: queryKeys.trips.shared(),
    queryFn: () => api<TripListItem[]>("/api/trips?scope=shared"),
  });
  useAuthRedirect(sharedError);

  // Treat 401 as loading (useAuthRedirect handles the redirect)
  const isUnauthorized =
    (ownedError instanceof ApiError && ownedError.status === 401) ||
    (sharedError instanceof ApiError && sharedError.status === 401);
  const isLoading = ownedLoading || sharedLoading || isUnauthorized;
  const error = isUnauthorized ? null : ownedError || sharedError;

  const [tab, setTab] = useState<HomeTab>("owned");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [createTripOpen, setCreateTripOpen] = useState(false);
  const [selectionMode, setSelectionModeRaw] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const baseTrips = useMemo(
    () => (tab === "shared" ? sharedTrips : ownedTrips),
    [tab, ownedTrips, sharedTrips],
  );

  const filteredTrips = useMemo(() => {
    let result = baseTrips;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) || (t.destination?.toLowerCase().includes(q) ?? false),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (sortKey === "startDate") {
      result = [...result].sort((a, b) => {
        const aDate = a.startDate ?? "";
        const bDate = b.startDate ?? "";
        return aDate < bDate ? 1 : aDate > bDate ? -1 : 0;
      });
    }

    return result;
  }, [baseTrips, search, statusFilter, sortKey]);

  // Prune selectedIds to only include visible items when filters change
  useEffect(() => {
    if (!selectionMode) return;
    const visibleIds = new Set(filteredTrips.map((t) => t.id));
    setSelectedIds((prev) => {
      const pruned = new Set([...prev].filter((id) => visibleIds.has(id)));
      if (pruned.size === prev.size) return prev;
      return pruned;
    });
  }, [filteredTrips, selectionMode]);

  function setSelectionMode(mode: boolean) {
    setSelectionModeRaw(mode);
    if (!mode) setSelectedIds(new Set());
  }

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.owned() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.shared() }),
    ]);
  }

  function handleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    setSelectedIds(new Set(filteredTrips.map((t) => t.id)));
  }

  function handleDeselectAll() {
    setSelectedIds(new Set());
  }

  async function handleDeleteSelected() {
    const ids = [...selectedIds];
    const count = ids.length;
    const idSet = new Set(ids);

    const cacheKey = queryKeys.trips.owned();
    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripListItem[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((t) => !idSet.has(t.id)),
      );
    }
    setSelectedIds(new Set());
    setSelectionModeRaw(false);

    setDeleting(true);
    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/trips/${id}`, { method: "DELETE" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(tm("tripBulkDeleteFailed", { count: failed }));
    } else {
      toast.success(tm("tripBulkDeleted", { count }));
    }
    await invalidateAll();
    setDeleting(false);
  }

  async function handleDuplicateSelected() {
    const ids = [...selectedIds];
    setDuplicating(true);

    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/trips/${id}/duplicate`, { method: "POST" })),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.filter((r) => r.status === "fulfilled").length;

    if (succeeded > 0) {
      await invalidateAll();
    }

    if (failed > 0) {
      toast.error(tm("tripBulkDuplicateFailed", { count: failed }));
    } else {
      toast.success(tm("tripBulkDuplicated", { count: succeeded }));
    }

    setSelectedIds(new Set());
    setSelectionModeRaw(false);
    setDuplicating(false);
  }

  return {
    ownedTrips,
    sharedTrips,
    isLoading,
    error,
    tab,
    setTab,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
    selectionMode,
    setSelectionMode,
    selectedIds,
    handleSelect,
    handleSelectAll,
    handleDeselectAll,
    deleting,
    duplicating,
    handleDeleteSelected,
    handleDuplicateSelected,
    createTripOpen,
    setCreateTripOpen,
    baseTrips,
    filteredTrips,
    invalidateAll,
  };
}
