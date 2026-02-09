"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

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

    if (newStartDate > newEndDate) {
      setError("出発日は帰着日より前に設定してください");
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
      toast.success("旅行を更新しました");
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "旅行の更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>旅行を編集</DialogTitle>
          <DialogDescription>旅行の情報を変更します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">タイトル</Label>
            <Input id="edit-title" name="title" defaultValue={title} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-destination">目的地</Label>
            <Input id="edit-destination" name="destination" defaultValue={destination} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-startDate">出発日</Label>
              <Input id="edit-startDate" name="startDate" type="date" defaultValue={startDate} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endDate">帰着日</Label>
              <Input id="edit-endDate" name="endDate" type="date" defaultValue={endDate} required />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "更新中..." : "旅行を更新"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
