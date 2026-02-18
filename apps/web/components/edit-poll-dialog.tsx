"use client";

import {
  POLL_DESTINATION_MAX_LENGTH,
  POLL_NOTE_MAX_LENGTH,
  POLL_TITLE_MAX_LENGTH,
} from "@sugara/shared";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";

type EditPollDialogProps = {
  pollId: string;
  title: string;
  destination: string;
  note: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
};

export function EditPollDialog({
  pollId,
  title,
  destination,
  note,
  open,
  onOpenChange,
  onUpdate,
}: EditPollDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editNote, setEditNote] = useState(note ?? "");

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setError(null);
    } else {
      setEditNote(note ?? "");
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      destination: formData.get("destination") as string,
      note: editNote || null,
    };

    try {
      await api(`/api/polls/${pollId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      onOpenChange(false);
      toast.success(MSG.POLL_UPDATED);
      onUpdate();
    } catch (err) {
      setError(getApiErrorMessage(err, MSG.POLL_UPDATE_FAILED));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>日程調整を編集</DialogTitle>
          <DialogDescription>日程調整の情報を変更します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-poll-title">
              タイトル <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-poll-title"
              name="title"
              defaultValue={title}
              maxLength={POLL_TITLE_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-poll-destination">
              目的地 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-poll-destination"
              name="destination"
              defaultValue={destination}
              maxLength={POLL_DESTINATION_MAX_LENGTH}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-poll-note">メモ</Label>
            <Textarea
              id="edit-poll-note"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="参加者への連絡事項など"
              maxLength={POLL_NOTE_MAX_LENGTH}
              rows={2}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              <Check className="h-4 w-4" />
              {loading ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
