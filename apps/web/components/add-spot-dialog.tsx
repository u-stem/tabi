"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { CATEGORY_LABELS } from "@tabi/shared";

type AddSpotDialogProps = {
  tripId: string;
  dayId: string;
  onAdded: () => void;
};

const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function AddSpotDialog({ tripId, dayId, onAdded }: AddSpotDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("sightseeing");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      category,
      startTime: (formData.get("startTime") as string) || undefined,
      endTime: (formData.get("endTime") as string) || undefined,
      memo: (formData.get("memo") as string) || undefined,
    };

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/spots`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setOpen(false);
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "スポットの追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          + スポット追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>スポットを追加</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名前</Label>
            <Input id="name" name="name" placeholder="金閣寺" required />
          </div>
          <div className="space-y-2">
            <Label>カテゴリ</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">開始時間</Label>
              <Input id="startTime" name="startTime" type="time" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">終了時間</Label>
              <Input id="endTime" name="endTime" type="time" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">メモ</Label>
            <Textarea id="memo" name="memo" rows={3} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "追加中..." : "スポットを追加"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
