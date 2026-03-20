"use client";

import type { ScheduleResponse } from "@sugara/shared";
import { shiftTime } from "@sugara/shared";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";

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
  const tm = useTranslations("messages");
  const ts = useTranslations("schedule");
  const [loading, setLoading] = useState(false);

  const direction = deltaMinutes > 0 ? ts("batchShiftLater") : ts("batchShiftEarlier");
  const absDelta = Math.abs(deltaMinutes);
  const sourceLabel =
    deltaSource === "end" ? ts("batchShiftSourceEnd") : ts("batchShiftSourceStart");

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
        toast.success(
          tm("batchShiftPartial", { updated: result.updatedCount, skipped: result.skippedCount }),
        );
      } else {
        toast.success(tm("batchShiftSuccess", { count: result.updatedCount }));
      }
      onOpenChange(false);
      onDone();
    } catch {
      toast.error(tm("batchShiftFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveAlertDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>{ts("batchShiftTitle")}</ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            {ts("batchShiftDescription", {
              name: scheduleName,
              source: sourceLabel,
              delta: absDelta,
              direction,
              count: targetSchedules.length,
            })}
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
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
          {remaining > 0 && (
            <p className="text-xs text-muted-foreground">
              {ts("batchShiftOthers", { count: remaining })}
            </p>
          )}
        </div>
        {skippedSchedules.length > 0 && (
          <div className="flex items-start gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div>
              {skippedSchedules.map((s) => (
                <p key={s.id}>
                  {ts("batchShiftSkipped", {
                    name: s.name,
                    time: s.startTime ? `(${formatTime(s.startTime)})` : "",
                  })}
                </p>
              ))}
            </div>
          </div>
        )}
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel disabled={loading}>
            {ts("batchShiftOnlyThis")}
          </ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogAction onClick={handleShift} disabled={loading}>
            {loading ? ts("adding") : ts("batchShiftAll")}
          </ResponsiveAlertDialogAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  );
}
