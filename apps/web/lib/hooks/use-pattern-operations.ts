import type { DayPatternResponse, TripResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type UsePatternOperationsArgs = {
  tripId: string;
  currentDayId: string | null;
  onDone: () => void;
  onPatternDeleted: (dayId: string) => void;
};

export function usePatternOperations({
  tripId,
  currentDayId,
  onDone,
  onPatternDeleted,
}: UsePatternOperationsArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DayPatternResponse | null>(null);
  const [renameTarget, setRenameTarget] = useState<DayPatternResponse | null>(null);
  const [renameLabel, setRenameLabel] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDayId || !addLabel.trim()) return;
    setAddLoading(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDayId}/patterns`, {
        method: "POST",
        body: JSON.stringify({ label: addLabel.trim() }),
      });
      toast.success(MSG.PATTERN_ADDED);
      setAddOpen(false);
      setAddLabel("");
      onDone();
    } catch {
      toast.error(MSG.PATTERN_ADD_FAILED);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDuplicate(patternId: string) {
    if (!currentDayId) return;
    try {
      await api(`/api/trips/${tripId}/days/${currentDayId}/patterns/${patternId}/duplicate`, {
        method: "POST",
      });
      toast.success(MSG.PATTERN_DUPLICATED);
      onDone();
    } catch {
      toast.error(MSG.PATTERN_DUPLICATE_FAILED);
    }
  }

  async function handleDelete(patternId: string) {
    if (!currentDayId) return;
    const dayId = currentDayId;

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, {
        ...prev,
        days: prev.days.map((d) =>
          d.id !== dayId ? d : { ...d, patterns: d.patterns.filter((p) => p.id !== patternId) },
        ),
      });
    }
    toast.success(MSG.PATTERN_DELETED);
    onPatternDeleted(dayId);

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}`, {
        method: "DELETE",
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.PATTERN_DELETE_FAILED);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDayId || !renameTarget || !renameLabel.trim()) return;
    const dayId = currentDayId;
    const patternId = renameTarget.id;
    const newLabel = renameLabel.trim();

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, {
        ...prev,
        days: prev.days.map((d) =>
          d.id !== dayId
            ? d
            : {
                ...d,
                patterns: d.patterns.map((p) =>
                  p.id !== patternId ? p : { ...p, label: newLabel },
                ),
              },
        ),
      });
    }
    toast.success(MSG.PATTERN_RENAMED);
    setRenameTarget(null);
    setRenameLabel("");

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}`, {
        method: "PATCH",
        body: JSON.stringify({ label: newLabel }),
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.PATTERN_RENAME_FAILED);
    }
  }

  function startRename(pattern: DayPatternResponse) {
    setRenameTarget(pattern);
    setRenameLabel(pattern.label);
  }

  return {
    add: {
      open: addOpen,
      setOpen: (open: boolean) => {
        setAddOpen(open);
        if (!open) setAddLabel("");
      },
      label: addLabel,
      setLabel: setAddLabel,
      loading: addLoading,
      submit: handleAdd,
    },
    rename: {
      target: renameTarget,
      setOpen: (open: boolean) => {
        if (!open) {
          setRenameTarget(null);
          setRenameLabel("");
        }
      },
      label: renameLabel,
      setLabel: setRenameLabel,
      submit: handleRename,
      start: startRename,
    },
    deleteTarget,
    setDeleteTarget,
    handleDuplicate,
    handleDelete,
  };
}
