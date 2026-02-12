"use client";

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
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

type EditTripDialogProps = {
  tripId: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState(startDate);
  const [editEndDate, setEditEndDate] = useState(endDate);

  useEffect(() => {
    if (open) {
      setEditStartDate(startDate);
      setEditEndDate(endDate);
    }
  }, [open, startDate, endDate]);

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

    if (!newStartDate || !newEndDate) {
      setError(MSG.TRIP_DATE_REQUIRED);
      setLoading(false);
      return;
    }

    const data = {
      title: formData.get("title") as string,
      destination: formData.get("destination") as string,
      startDate: newStartDate,
      endDate: newEndDate,
    };

    try {
      await api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      onOpenChange(false);
      toast.success(MSG.TRIP_UPDATED);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : MSG.TRIP_UPDATE_FAILED);
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
            <Input id="edit-title" name="title" defaultValue={title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-destination">
              目的地 <span className="text-destructive">*</span>
            </Label>
            <Input id="edit-destination" name="destination" defaultValue={destination} required />
          </div>
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
