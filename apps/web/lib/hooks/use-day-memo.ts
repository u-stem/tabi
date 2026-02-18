import type { TripResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type UseDayMemoArgs = {
  tripId: string;
  currentDayId: string | null;
  onDone: () => void;
};

export function useDayMemo({ tripId, currentDayId, onDone }: UseDayMemoArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(dayId: string, currentMemo: string | null | undefined) {
    setEditingDayId(dayId);
    setText(currentMemo ?? "");
  }

  function cancelEdit() {
    setEditingDayId(null);
    setText("");
  }

  async function save() {
    if (!currentDayId || editingDayId !== currentDayId) return;
    setSaving(true);
    const dayId = currentDayId;
    const newMemo = text.trim() || null;

    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, {
        ...prev,
        days: prev.days.map((d) => (d.id !== dayId ? d : { ...d, memo: newMemo })),
      });
    }
    toast.success(MSG.DAY_MEMO_UPDATED);
    setEditingDayId(null);
    setText("");

    try {
      await api(`/api/trips/${tripId}/days/${dayId}`, {
        method: "PATCH",
        body: JSON.stringify({ memo: newMemo }),
      });
      onDone();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.DAY_MEMO_UPDATE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  return {
    editingDayId,
    text,
    setText,
    saving,
    startEdit,
    cancelEdit,
    save,
  };
}
