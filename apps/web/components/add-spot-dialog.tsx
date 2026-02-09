"use client";

import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@tabi/shared";
import type { TransportMethod } from "@tabi/shared";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type AddSpotDialogProps = {
  tripId: string;
  dayId: string;
  onAdd: () => void;
  disabled?: boolean;
};

const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const transportMethods = Object.entries(TRANSPORT_METHOD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

function getTimeLabels(cat: string) {
  if (cat === "transport") return { start: "出発時間", end: "到着時間" };
  if (cat === "hotel") return { start: "チェックイン", end: "チェックアウト" };
  return { start: "開始時間", end: "終了時間" };
}

export function AddSpotDialog({ tripId, dayId, onAdd, disabled }: AddSpotDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("sightseeing");
  const [transportMethod, setTransportMethod] = useState<TransportMethod | "">("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      category,
      address: category !== "transport" ? (formData.get("address") as string) || undefined : undefined,
      url: (formData.get("url") as string) || undefined,
      startTime: (formData.get("startTime") as string) || undefined,
      endTime: (formData.get("endTime") as string) || undefined,
      memo: (formData.get("memo") as string) || undefined,
      ...(category === "transport"
        ? {
            departurePlace: (formData.get("departurePlace") as string) || undefined,
            arrivalPlace: (formData.get("arrivalPlace") as string) || undefined,
            transportMethod: transportMethod || undefined,
          }
        : {}),
    };

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/spots`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setOpen(false);
      toast.success("スポットを追加しました");
      onAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : "スポットの追加に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setError(null);
          setCategory("sightseeing");
          setTransportMethod("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          + スポット追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>スポットを追加</DialogTitle>
          <DialogDescription>旅行の日程にスポットを追加します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">名前</Label>
            <Input id="name" name="name" placeholder="金閣寺" required />
          </div>
          <div className="space-y-2">
            <Label>カテゴリ</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v);
                setTransportMethod("");
              }}
            >
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
          {category !== "transport" && (
            <div className="space-y-2">
              <Label htmlFor="address">住所</Label>
              <Input id="address" name="address" placeholder="京都市北区金閣寺町1" />
            </div>
          )}
          {category === "transport" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="departurePlace">出発地</Label>
                <Input id="departurePlace" name="departurePlace" placeholder="東京駅" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrivalPlace">到着地</Label>
                <Input id="arrivalPlace" name="arrivalPlace" placeholder="新大阪駅" />
              </div>
              <div className="space-y-2">
                <Label>交通手段</Label>
                <Select
                  value={transportMethod}
                  onValueChange={(v) => setTransportMethod(v as TransportMethod)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" type="url" placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">{getTimeLabels(category).start}</Label>
              <Input id="startTime" name="startTime" type="time" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">{getTimeLabels(category).end}</Label>
              <Input id="endTime" name="endTime" type="time" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">メモ</Label>
            <Textarea id="memo" name="memo" rows={3} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "追加中..." : "スポットを追加"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
