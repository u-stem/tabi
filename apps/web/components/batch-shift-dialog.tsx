"use client";

import type { ScheduleResponse } from "@sugara/shared";
import { shiftTime } from "@sugara/shared";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { MSG } from "@/lib/messages";

type BatchShiftDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  dayId: string;
  patternId: string;
  scheduleName: string;
  deltaMinutes: number;
  deltaSource: "start" | "end";
  targetSchedules: ScheduleResponse[];
  skippedSchedules: ScheduleResponse[];
  onDone: () => void;
};

export function BatchShiftDialog({
  open,
  onOpenChange,
  tripId,
  dayId,
  patternId,
  scheduleName,
  deltaMinutes,
  deltaSource,
  targetSchedules,
  skippedSchedules,
  onDone,
}: BatchShiftDialogProps) {
  const [loading, setLoading] = useState(false);

  const direction = deltaMinutes > 0 ? "遅く" : "早く";
  const absDelta = Math.abs(deltaMinutes);
  const sourceLabel = deltaSource === "end" ? "終了" : "開始";

  // Preview shifted times
  const previews = targetSchedules.slice(0, 3).map((s) => {
    const newStart = s.startTime ? shiftTime(s.startTime, deltaMinutes) : null;
    const newEnd =
      s.endTime && (!s.endDayOffset || s.endDayOffset === 0)
        ? shiftTime(s.endTime, deltaMinutes)
        : null;
    return {
      id: s.id,
      name: s.name,
      before: s.startTime ? formatTime(s.startTime) : undefined,
      after: newStart ? formatTime(newStart) : undefined,
      beforeEnd: s.endTime ? formatTime(s.endTime) : undefined,
      afterEnd: newEnd ? formatTime(newEnd) : undefined,
    };
  });

  const remaining = targetSchedules.length - previews.length;

  async function handleShift() {
    setLoading(true);
    try {
      const result = await api<{ updatedCount: number; skippedCount: number }>(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/batch-shift`,
        {
          method: "POST",
          body: JSON.stringify({
            scheduleIds: targetSchedules.map((s) => s.id),
            deltaMinutes,
          }),
        },
      );
      if (result.skippedCount > 0) {
        toast.success(MSG.BATCH_SHIFT_PARTIAL(result.updatedCount, result.skippedCount));
      } else {
        toast.success(MSG.BATCH_SHIFT_SUCCESS(result.updatedCount));
      }
      onOpenChange(false);
      onDone();
    } catch {
      toast.error(MSG.BATCH_SHIFT_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>以降の予定の時間を調整</AlertDialogTitle>
          <AlertDialogDescription>
            「{scheduleName}」の{sourceLabel}時間が{absDelta}分{direction}なりました。以降の
            {targetSchedules.length}件の予定も同じ分だけずらしますか？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5 text-sm">
          {previews.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">{p.name}</span>
              {p.before && p.after && (
                <span className="shrink-0 tabular-nums">
                  {p.before} → {p.after}
                </span>
              )}
            </div>
          ))}
          {remaining > 0 && <p className="text-xs text-muted-foreground">他{remaining}件</p>}
        </div>
        {skippedSchedules.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              {skippedSchedules.map((s) => (
                <p key={s.id}>
                  「{s.name}」{s.startTime ? `(${formatTime(s.startTime)})` : ""}
                  は範囲外のためスキップされます
                </p>
              ))}
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>この予定だけ</AlertDialogCancel>
          <AlertDialogAction onClick={handleShift} disabled={loading}>
            {loading ? "更新中..." : "以降もずらす"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
