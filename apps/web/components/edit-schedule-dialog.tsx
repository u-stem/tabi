"use client";

import type { ScheduleColor, ScheduleResponse, TransportMethod } from "@sugara/shared";
import { SCHEDULE_COLOR_LABELS, SCHEDULE_COLORS } from "@sugara/shared";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TimeInput } from "@/components/time-input";
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
import { ApiError, api } from "@/lib/api";
import { SCHEDULE_COLOR_CLASSES } from "@/lib/colors";
import { validateTimeRange } from "@/lib/format";
import { MSG } from "@/lib/messages";
import {
  CATEGORY_OPTIONS,
  getEndDayOptions,
  getTimeLabels,
  TRANSPORT_METHOD_OPTIONS,
} from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

type EditScheduleDialogProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  schedule: ScheduleResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  maxEndDayOffset?: number;
};

export function EditScheduleDialog({
  tripId,
  dayId,
  patternId,
  schedule,
  open,
  onOpenChange,
  onUpdate,
  maxEndDayOffset = 0,
}: EditScheduleDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(schedule.category);
  const [transportMethod, setTransportMethod] = useState<TransportMethod | "">(
    (schedule.transportMethod as TransportMethod) || "",
  );
  const [color, setColor] = useState<ScheduleColor>(schedule.color);
  const [startTime, setStartTime] = useState<string | undefined>(schedule.startTime ?? undefined);
  const [endTime, setEndTime] = useState<string | undefined>(schedule.endTime ?? undefined);
  const [endDayOffset, setEndDayOffset] = useState(schedule.endDayOffset ?? 0);
  const [timeError, setTimeError] = useState<string | null>(null);

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setError(null);
      setTimeError(null);
      setCategory(schedule.category);
      setTransportMethod((schedule.transportMethod as TransportMethod) || "");
      setColor(schedule.color);
      setStartTime(schedule.startTime ?? undefined);
      setEndTime(schedule.endTime ?? undefined);
      setEndDayOffset(schedule.endDayOffset ?? 0);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTimeError(null);

    const timeValidation = validateTimeRange(startTime, endTime, {
      allowOvernight: endDayOffset > 0,
      category,
    });
    if (timeValidation) {
      setTimeError(timeValidation);
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      category,
      color,
      address:
        category !== "transport" ? (formData.get("address") as string) || undefined : undefined,
      url: (formData.get("url") as string) || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      memo: (formData.get("memo") as string) || undefined,
      ...(category === "transport"
        ? {
            departurePlace: (formData.get("departurePlace") as string) || undefined,
            arrivalPlace: (formData.get("arrivalPlace") as string) || undefined,
            transportMethod: transportMethod || undefined,
          }
        : {}),
      endDayOffset: endDayOffset > 0 ? endDayOffset : null,
      expectedUpdatedAt: schedule.updatedAt,
    };

    try {
      await api(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${schedule.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      );
      onOpenChange(false);
      toast.success(MSG.SCHEDULE_UPDATED);
      onUpdate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(MSG.CONFLICT);
        onUpdate();
      } else {
        setError(err instanceof Error ? err.message : MSG.SCHEDULE_UPDATE_FAILED);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>予定を編集</DialogTitle>
          <DialogDescription>予定の情報を変更します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">名前</Label>
            <Input id="edit-name" name="name" defaultValue={schedule.name} required />
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
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>色</Label>
            <div className="flex gap-2">
              {SCHEDULE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full",
                    SCHEDULE_COLOR_CLASSES[c].bg,
                    color === c && `ring-2 ring-offset-1 ${SCHEDULE_COLOR_CLASSES[c].ring}`,
                  )}
                  aria-label={SCHEDULE_COLOR_LABELS[c]}
                />
              ))}
            </div>
          </div>
          {category !== "transport" && (
            <div className="space-y-2">
              <Label htmlFor="edit-address">住所</Label>
              <Input
                id="edit-address"
                name="address"
                defaultValue={schedule.address ?? ""}
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
                  defaultValue={schedule.departurePlace ?? ""}
                  placeholder="東京駅"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-arrivalPlace">到着地</Label>
                <Input
                  id="edit-arrivalPlace"
                  name="arrivalPlace"
                  defaultValue={schedule.arrivalPlace ?? ""}
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
                    {TRANSPORT_METHOD_OPTIONS.map((m) => (
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
              defaultValue={schedule.url ?? ""}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{getTimeLabels(category).start}</Label>
              <TimeInput value={startTime} onChange={setStartTime} />
            </div>
            <div className="space-y-2">
              <Label>{getTimeLabels(category).end}</Label>
              <TimeInput value={endTime} onChange={setEndTime} />
            </div>
          </div>
          {maxEndDayOffset > 0 && (
            <div className="space-y-2">
              <Label>{getTimeLabels(category).end}日</Label>
              <Select
                value={String(endDayOffset)}
                onValueChange={(v) => setEndDayOffset(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getEndDayOptions(maxEndDayOffset).map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {timeError && <p className="text-sm text-destructive">{timeError}</p>}
          <div className="space-y-2">
            <Label htmlFor="edit-memo">メモ</Label>
            <Textarea id="edit-memo" name="memo" rows={3} defaultValue={schedule.memo ?? ""} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            <Check className="h-4 w-4" />
            {loading ? "更新中..." : "予定を更新"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
