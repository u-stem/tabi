import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

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
      toast.success(`${selectedIds.size}件を予定に追加しました`);
      exit();
      onDone();
    } catch {
      toast.error("予定への追加に失敗しました");
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
      toast.success(`${selectedIds.size}件を候補に戻しました`);
      exit();
      onDone();
    } catch {
      toast.error("候補への移動に失敗しました");
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
      toast.success(`${selectedIds.size}件を削除しました`);
      exit();
      onDone();
    } catch {
      toast.error("削除に失敗しました");
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
      toast.success(`${selectedIds.size}件を複製しました`);
      exit();
      onDone();
    } catch {
      toast.error("複製に失敗しました");
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
      toast.success(`${selectedIds.size}件を複製しました`);
      exit();
      onDone();
    } catch {
      toast.error("複製に失敗しました");
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
