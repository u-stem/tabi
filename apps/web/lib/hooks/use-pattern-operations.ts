import type { DayPatternResponse, TripResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
  const tm = useTranslations("messages");
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DayPatternResponse | null>(null);
  const [renameTarget, setRenameTarget] = useState<DayPatternResponse | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [overwriteSource, setOverwriteSource] = useState<DayPatternResponse | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDayId || !addLabel.trim()) return;
    setAddLoading(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDayId}/patterns`, {
        method: "POST",
        body: JSON.stringify({ label: addLabel.trim() }),
      });
      toast.success(tm("patternAdded"));
      setAddOpen(false);
      setAddLabel("");
      onDone();
    } catch {
      toast.error(tm("patternAddFailed"));
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
      toast.success(tm("patternDuplicated"));
      onDone();
    } catch {
      toast.error(tm("patternDuplicateFailed"));
    }
  }

  async function handleDelete(patternId: string) {
    if (!currentDayId) return;
    const dayId = currentDayId;

    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, {
        ...prev,
        days: prev.days.map((d) =>
          d.id !== dayId ? d : { ...d, patterns: d.patterns.filter((p) => p.id !== patternId) },
        ),
      });
    }
    toast.success(tm("patternDeleted"));
    onPatternDeleted(dayId);

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}`, {
        method: "DELETE",
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(tm("patternDeleteFailed"));
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDayId || !renameTarget || !renameLabel.trim()) return;
    const dayId = currentDayId;
    const patternId = renameTarget.id;
    const newLabel = renameLabel.trim();

    await queryClient.cancelQueries({ queryKey: cacheKey });
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
    toast.success(tm("patternRenamed"));
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
      toast.error(tm("patternRenameFailed"));
    }
  }

  async function handleOverwrite(targetPatternId: string, sourcePatternId: string) {
    if (!currentDayId) return;
    try {
      await api(`/api/trips/${tripId}/days/${currentDayId}/patterns/${targetPatternId}/overwrite`, {
        method: "POST",
        body: JSON.stringify({ sourcePatternId }),
      });
      toast.success(tm("patternOverwritten"));
      setOverwriteSource(null);
      onDone();
    } catch {
      toast.error(tm("patternOverwriteFailed"));
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
    overwriteSource,
    setOverwriteSource,
    handleDuplicate,
    handleDelete,
    handleOverwrite,
  };
}
