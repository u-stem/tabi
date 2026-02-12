"use client";

import type { ScheduleCategory, ScheduleColor, TransportMethod } from "@sugara/shared";
import { DEFAULT_SCHEDULE_CATEGORY, SCHEDULE_COLOR_LABELS, SCHEDULE_COLORS } from "@sugara/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TimeInput } from "@/components/time-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

type AddScheduleDialogProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  onAdd: () => void;
  disabled?: boolean;
  maxEndDayOffset?: number;
};

export function AddScheduleDialog({
  tripId,
  dayId,
  patternId,
  onAdd,
  disabled,
  maxEndDayOffset = 0,
}: AddScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ScheduleCategory>(DEFAULT_SCHEDULE_CATEGORY);
  const [transportMethod, setTransportMethod] = useState<TransportMethod | "">("");
  const [color, setColor] = useState<ScheduleColor>("blue");
  const [startTime, setStartTime] = useState<string | undefined>();
  const [endTime, setEndTime] = useState<string | undefined>();
  const [endDayOffset, setEndDayOffset] = useState(0);
  const [timeError, setTimeError] = useState<string | null>(null);

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
      ...(endDayOffset > 0 ? { endDayOffset } : {}),
    };

    try {
      await api(`/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      setOpen(false);
      toast.success(MSG.SCHEDULE_ADDED);
      onAdd();
    } catch (err) {
      setError(err instanceof Error ? err.message : MSG.SCHEDULE_ADD_FAILED);
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
          setCategory(DEFAULT_SCHEDULE_CATEGORY);
          setTransportMethod("");
          setColor("blue");
          setStartTime(undefined);
          setEndTime(undefined);
          setEndDayOffset(0);
          setTimeError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Plus className="h-4 w-4" />
          予定を追加
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>予定を追加</DialogTitle>
          <DialogDescription>旅行の日程に予定を追加します</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              名前 <span className="text-destructive">*</span>
            </Label>
            <Input id="name" name="name" placeholder="金閣寺" required />
          </div>
          <div className="space-y-2">
            <Label>カテゴリ</Label>
            <Select
              value={category}
              onValueChange={(v) => {
                setCategory(v as ScheduleCategory);
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
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" type="url" placeholder="https://..." />
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
            <Label htmlFor="memo">メモ</Label>
            <Textarea id="memo" name="memo" rows={3} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "追加中..." : "予定を追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
