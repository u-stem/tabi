import type { TripResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import {
  moveCandidateToSchedule,
  moveScheduleToCandidate,
  removeCandidate,
  removeScheduleFromPattern,
} from "@/lib/trip-cache";

type SelectionTarget = "timeline" | "candidates";

type UseScheduleSelectionArgs = {
  tripId: string;
  currentDayId: string | null;
  currentPatternId: string | null;
  timelineScheduleIds: Set<string>;
  candidateIds: Set<string>;
  onDone: () => void;
};

export function useScheduleSelection({
  tripId,
  currentDayId,
  currentPatternId,
  timelineScheduleIds,
  candidateIds,
  onDone,
}: UseScheduleSelectionArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const [selectionTarget, setSelectionTarget] = useState<SelectionTarget | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  function enter(target: SelectionTarget) {
    setSelectionTarget(target);
    setSelectedIds(new Set());
  }

  function exit() {
    setSelectionTarget(null);
    setSelectedIds(new Set());
  }

  function toggle(id: string) {
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

  function selectAll() {
    if (selectionTarget === "timeline") {
      setSelectedIds(new Set(timelineScheduleIds));
    } else if (selectionTarget === "candidates") {
      setSelectedIds(new Set(candidateIds));
    }
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  // Prune selection when day/pattern changes
  useEffect(() => {
    if (!selectionTarget) return;
    setSelectedIds((prev) => {
      const validIds = selectionTarget === "timeline" ? timelineScheduleIds : candidateIds;
      const pruned = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) pruned.add(id);
      }
      return pruned.size === prev.size ? prev : pruned;
    });
  }, [selectionTarget, timelineScheduleIds, candidateIds]);

  async function batchAssign() {
    if (!currentPatternId || !currentDayId || selectedIds.size === 0) return;
    setBatchLoading(true);
    const count = selectedIds.size;
    const ids = [...selectedIds];

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      let next = prev;
      for (const id of ids) {
        next = moveCandidateToSchedule(next, id, currentDayId, currentPatternId);
      }
      queryClient.setQueryData(cacheKey, next);
    }
    toast.success(MSG.BATCH_ASSIGNED(count));
    exit();

    try {
      await api(`/api/trips/${tripId}/candidates/batch-assign`, {
        method: "POST",
        body: JSON.stringify({
          scheduleIds: ids,
          dayPatternId: currentPatternId,
        }),
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.BATCH_ASSIGN_FAILED);
    } finally {
      setBatchLoading(false);
    }
  }

  async function batchUnassign() {
    if (!currentDayId || !currentPatternId || selectedIds.size === 0) return;
    setBatchLoading(true);
    const count = selectedIds.size;
    const ids = [...selectedIds];

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      let next = prev;
      for (const id of ids) {
        next = moveScheduleToCandidate(next, currentDayId, currentPatternId, id);
      }
      queryClient.setQueryData(cacheKey, next);
    }
    toast.success(MSG.BATCH_UNASSIGNED(count));
    exit();

    try {
      await api(`/api/trips/${tripId}/schedules/batch-unassign`, {
        method: "POST",
        body: JSON.stringify({ scheduleIds: ids }),
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.BATCH_UNASSIGN_FAILED);
    } finally {
      setBatchLoading(false);
    }
  }

  async function batchDelete() {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    const count = selectedIds.size;
    const ids = [...selectedIds];
    const target = selectionTarget;

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      let next = prev;
      if (target === "candidates") {
        for (const id of ids) {
          next = removeCandidate(next, id);
        }
      } else if (target === "timeline" && currentDayId && currentPatternId) {
        for (const id of ids) {
          next = removeScheduleFromPattern(next, currentDayId, currentPatternId, id);
        }
      }
      queryClient.setQueryData(cacheKey, next);
    }
    toast.success(MSG.BATCH_DELETED(count));
    exit();

    try {
      if (target === "candidates") {
        await api(`/api/trips/${tripId}/candidates/batch-delete`, {
          method: "POST",
          body: JSON.stringify({ scheduleIds: ids }),
        });
      } else if (target === "timeline" && currentDayId && currentPatternId) {
        await api(
          `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/batch-delete`,
          {
            method: "POST",
            body: JSON.stringify({ scheduleIds: ids }),
          },
        );
      }
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.BATCH_DELETE_FAILED);
    } finally {
      setBatchLoading(false);
      setBatchDeleteOpen(false);
    }
  }

  async function batchDuplicateCandidates() {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      await api(`/api/trips/${tripId}/candidates/batch-duplicate`, {
        method: "POST",
        body: JSON.stringify({ scheduleIds: [...selectedIds] }),
      });
      toast.success(MSG.BATCH_DUPLICATED(selectedIds.size));
      exit();
      onDone();
    } catch {
      toast.error(MSG.BATCH_DUPLICATE_FAILED);
    } finally {
      setBatchLoading(false);
    }
  }

  async function batchDuplicateSchedules() {
    if (!currentPatternId || !currentDayId || selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      await api(
        `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/batch-duplicate`,
        {
          method: "POST",
          body: JSON.stringify({ scheduleIds: [...selectedIds] }),
        },
      );
      toast.success(MSG.BATCH_DUPLICATED(selectedIds.size));
      exit();
      onDone();
    } catch {
      toast.error(MSG.BATCH_DUPLICATE_FAILED);
    } finally {
      setBatchLoading(false);
    }
  }

  return {
    selectionTarget,
    selectedIds,
    batchLoading,
    batchDeleteOpen,
    setBatchDeleteOpen,
    enter,
    exit,
    toggle,
    selectAll,
    deselectAll,
    batchAssign,
    batchUnassign,
    batchDelete,
    batchDuplicateCandidates,
    batchDuplicateSchedules,
  };
}
