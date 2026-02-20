"use client";

import { TRIP_DESTINATION_MAX_LENGTH, TRIP_TITLE_MAX_LENGTH } from "@sugara/shared";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DateRangePicker } from "@/components/date-range-picker";
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
import { api, getApiErrorMessage } from "@/lib/api";
import { getDayCount } from "@/lib/format";
import { MSG } from "@/lib/messages";

type EditTripDialogProps = {
  tripId: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
};

export function EditTripDialog({
  tripId,
  title,
  destination,
  startDate,
  endDate,
  open,
  onOpenChange,
  onUpdate,
}: EditTripDialogProps) {
  const [editTitle, setEditTitle] = useState(title);
  const [editDestination, setEditDestination] = useState(destination ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDates = startDate != null && endDate != null;
  const [editStartDate, setEditStartDate] = useState(startDate ?? "");
  const [editEndDate, setEditEndDate] = useState(endDate ?? "");

  useEffect(() => {
    if (open) {
      setEditTitle(title);
      setEditDestination(destination ?? "");
      setEditStartDate(startDate ?? "");
      setEditEndDate(endDate ?? "");
    }
  }, [open, title, destination, startDate, endDate]);

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newStartDate = formData.get("startDate") as string;
    const newEndDate = formData.get("endDate") as string;

    if (hasDates && (!newStartDate || !newEndDate)) {
      setError(MSG.TRIP_DATE_REQUIRED);
      setLoading(false);
      return;
    }

    if (hasDates && newStartDate && newEndDate && startDate && endDate) {
      const oldCount = getDayCount(startDate, endDate);
      const newCount = getDayCount(newStartDate, newEndDate);
      if (newCount < oldCount) {
        setError(MSG.TRIP_DAYS_REDUCED);
        setLoading(false);
        return;
      }
    }

    const rawDestination = (formData.get("destination") as string).trim();
    const data: Record<string, unknown> = {
      title: formData.get("title") as string,
      destination: rawDestination || null,
    };
    if (newStartDate && newEndDate) {
      data.startDate = newStartDate;
      data.endDate = newEndDate;
    }

    try {
      await api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      onOpenChange(false);
      toast.success(MSG.TRIP_UPDATED);
      onUpdate();
    } catch (err) {
      setError(getApiErrorMessage(err, MSG.TRIP_UPDATE_FAILED));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>旅行を編集</DialogTitle>
          <DialogDescription>旅行の情報を変更します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">
              タイトル <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              name="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="京都3日間の旅"
              maxLength={TRIP_TITLE_MAX_LENGTH}
              required
            />
            <p className="text-right text-xs text-muted-foreground">
              {editTitle.length}/{TRIP_TITLE_MAX_LENGTH}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-destination">目的地</Label>
            <Input
              id="edit-destination"
              name="destination"
              value={editDestination}
              onChange={(e) => setEditDestination(e.target.value)}
              placeholder="京都"
              maxLength={TRIP_DESTINATION_MAX_LENGTH}
            />
            <p className="text-right text-xs text-muted-foreground">
              {editDestination.length}/{TRIP_DESTINATION_MAX_LENGTH}
            </p>
          </div>
          {hasDates && (
            <div className="space-y-2">
              <Label>
                旅行期間 <span className="text-destructive">*</span>
              </Label>
              <DateRangePicker
                startDate={editStartDate}
                endDate={editEndDate}
                onChangeStart={setEditStartDate}
                onChangeEnd={setEditEndDate}
              />
              <input type="hidden" name="startDate" value={editStartDate} />
              <input type="hidden" name="endDate" value={editEndDate} />
            </div>
          )}
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
