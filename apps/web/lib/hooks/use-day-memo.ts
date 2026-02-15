import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

type UseDayMemoArgs = {
  tripId: string;
  currentDayId: string | null;
  onDone: () => void;
};

export function useDayMemo({ tripId, currentDayId, onDone }: UseDayMemoArgs) {
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
    try {
      await api(`/api/trips/${tripId}/days/${currentDayId}`, {
        method: "PATCH",
        body: JSON.stringify({ memo: text.trim() || null }),
      });
      toast.success(MSG.DAY_MEMO_UPDATED);
      setEditingDayId(null);
      setText("");
      onDone();
    } catch {
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
