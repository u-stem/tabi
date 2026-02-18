"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { MSG } from "@/lib/messages";

type CreateTripDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateTripDialog({ open, onOpenChange, onCreated }: CreateTripDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function resetAll() {
    setError(null);
    setLoading(false);
    setStartDate("");
    setEndDate("");
  }

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) resetAll();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      destination: formData.get("destination") as string,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
    };

    if (!data.startDate || !data.endDate) {
      setError(MSG.TRIP_DATE_REQUIRED);
      setLoading(false);
      return;
    }

    try {
      const trip = await api<{ id: string }>("/api/trips", {
        method: "POST",
        body: JSON.stringify(data),
      });
      onOpenChange(false);
      toast.success(MSG.TRIP_CREATED);
      onCreated();
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err, MSG.TRIP_CREATE_FAILED));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新しい旅行を作成</DialogTitle>
          <DialogDescription>旅行の基本情報を入力してください</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create-title">
              旅行タイトル <span className="text-destructive">*</span>
            </Label>
            <Input id="create-title" name="title" placeholder="京都3日間の旅" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-destination">
              目的地 <span className="text-destructive">*</span>
            </Label>
            <Input id="create-destination" name="destination" placeholder="京都" required />
          </div>
          <div className="space-y-2">
            <Label>
              旅行期間 <span className="text-destructive">*</span>
            </Label>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChangeStart={setStartDate}
              onChangeEnd={setEndDate}
            />
            <input type="hidden" name="startDate" value={startDate} />
            <input type="hidden" name="endDate" value={endDate} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
