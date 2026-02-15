import type { DayPatternResponse } from "@sugara/shared";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

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
  const [addOpen, setAddOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DayPatternResponse | null>(null);
  const [renameTarget, setRenameTarget] = useState<DayPatternResponse | null>(null);
  const [renameLabel, setRenameLabel] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

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
    try {
      await api(`/api/trips/${tripId}/days/${currentDayId}/patterns/${patternId}`, {
        method: "DELETE",
      });
      toast.success(MSG.PATTERN_DELETED);
      onPatternDeleted(currentDayId);
      onDone();
    } catch {
      toast.error(MSG.PATTERN_DELETE_FAILED);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDayId || !renameTarget || !renameLabel.trim()) return;
    setRenameLoading(true);
    try {
      await api(`/api/trips/${tripId}/days/${currentDayId}/patterns/${renameTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: renameLabel.trim() }),
      });
      toast.success(MSG.PATTERN_RENAMED);
      setRenameTarget(null);
      setRenameLabel("");
      onDone();
    } catch {
      toast.error(MSG.PATTERN_RENAME_FAILED);
    } finally {
      setRenameLoading(false);
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
      loading: renameLoading,
      submit: handleRename,
      start: startRename,
    },
    deleteTarget,
    setDeleteTarget,
    handleDuplicate,
    handleDelete,
  };
}
