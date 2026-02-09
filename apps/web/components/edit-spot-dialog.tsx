"use client";

import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@tabi/shared";
import type { SpotResponse, TransportMethod } from "@tabi/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

type EditSpotDialogProps = {
  tripId: string;
  dayId: string;
  spot: SpotResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
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

export function EditSpotDialog({
  tripId,
  dayId,
  spot,
  open,
  onOpenChange,
  onUpdate,
}: EditSpotDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(spot.category);
  const [transportMethod, setTransportMethod] = useState<TransportMethod | "">(
    (spot.transportMethod as TransportMethod) || "",
  );

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setError(null);
      setCategory(spot.category);
      setTransportMethod((spot.transportMethod as TransportMethod) || "");
    }
  }

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
      await api(`/api/trips/${tripId}/days/${dayId}/spots/${spot.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      onOpenChange(false);
      toast.success("スポットを更新しました");
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "スポットの更新に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>スポットを編集</DialogTitle>
          <DialogDescription>スポットの情報を変更します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">名前</Label>
            <Input id="edit-name" name="name" defaultValue={spot.name} required />
          </div>
          <div className="space-y-2">
            <Label>カテゴリ</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v as typeof category);
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
              <Label htmlFor="edit-address">住所</Label>
              <Input
                id="edit-address"
                name="address"
                defaultValue={spot.address ?? ""}
                placeholder="京都市北区金閣寺町1"
              />
            </div>
          )}
          {category === "transport" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-departurePlace">出発地</Label>
                <Input
                  id="edit-departurePlace"
                  name="departurePlace"
                  defaultValue={spot.departurePlace ?? ""}
                  placeholder="東京駅"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-arrivalPlace">到着地</Label>
                <Input
                  id="edit-arrivalPlace"
                  name="arrivalPlace"
                  defaultValue={spot.arrivalPlace ?? ""}
                  placeholder="新大阪駅"
                />
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
            <Label htmlFor="edit-url">URL</Label>
            <Input
              id="edit-url"
              name="url"
              type="url"
              defaultValue={spot.url ?? ""}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-startTime">{getTimeLabels(category).start}</Label>
              <Input
                id="edit-startTime"
                name="startTime"
                type="time"
                defaultValue={spot.startTime ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-endTime">{getTimeLabels(category).end}</Label>
              <Input
                id="edit-endTime"
                name="endTime"
                type="time"
                defaultValue={spot.endTime ?? ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-memo">メモ</Label>
            <Textarea id="edit-memo" name="memo" rows={3} defaultValue={spot.memo ?? ""} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "更新中..." : "スポットを更新"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
