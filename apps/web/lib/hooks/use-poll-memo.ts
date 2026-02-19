import type { PollDetailResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type UsePollMemoArgs = {
  pollId: string;
  onDone?: () => void;
};

export function usePollMemo({ pollId, onDone }: UsePollMemoArgs) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.polls.detail(pollId);

  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit(currentNote: string | null | undefined) {
    setEditing(true);
    setText(currentNote ?? "");
  }

  function cancelEdit() {
    setEditing(false);
    setText("");
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const newNote = text.trim() || null;

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<PollDetailResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, { ...prev, note: newNote });
    }
    toast.success(MSG.POLL_NOTE_UPDATED);
    setEditing(false);
    setText("");

    try {
      await api(`/api/polls/${pollId}`, {
        method: "PATCH",
        body: JSON.stringify({ note: newNote }),
      });
      onDone?.();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.POLL_NOTE_UPDATE_FAILED);
    } finally {
      setSaving(false);
    }
  }

  return { editing, text, setText, saving, startEdit, cancelEdit, save };
}
