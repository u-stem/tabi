import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

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
    if (!currentPatternId || selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      await api(`/api/trips/${tripId}/candidates/batch-assign`, {
        method: "POST",
        body: JSON.stringify({
          scheduleIds: [...selectedIds],
          dayPatternId: currentPatternId,
        }),
      });
      toast.success(MSG.BATCH_ASSIGNED(selectedIds.size));
      exit();
      onDone();
    } catch {
      toast.error(MSG.BATCH_ASSIGN_FAILED);
    } finally {
      setBatchLoading(false);
    }
  }

  async function batchUnassign() {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      await api(`/api/trips/${tripId}/schedules/batch-unassign`, {
        method: "POST",
        body: JSON.stringify({ scheduleIds: [...selectedIds] }),
      });
      toast.success(MSG.BATCH_UNASSIGNED(selectedIds.size));
      exit();
      onDone();
    } catch {
      toast.error(MSG.BATCH_UNASSIGN_FAILED);
    } finally {
      setBatchLoading(false);
    }
  }

  async function batchDelete() {
    if (selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      if (selectionTarget === "candidates") {
        await api(`/api/trips/${tripId}/candidates/batch-delete`, {
          method: "POST",
          body: JSON.stringify({ scheduleIds: [...selectedIds] }),
        });
      } else if (selectionTarget === "timeline" && currentDayId && currentPatternId) {
        await api(
          `/api/trips/${tripId}/days/${currentDayId}/patterns/${currentPatternId}/schedules/batch-delete`,
          {
            method: "POST",
            body: JSON.stringify({ scheduleIds: [...selectedIds] }),
          },
        );
      }
      toast.success(MSG.BATCH_DELETED(selectedIds.size));
      exit();
      onDone();
    } catch {
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
