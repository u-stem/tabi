"use client";

import type {
  ScheduleColor,
  ScheduleResponse,
  TimeDelta,
  TransportMethod,
  TripResponse,
} from "@sugara/shared";
import { computeTimeDelta } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ScheduleFormFields } from "@/components/schedule-form-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError, api } from "@/lib/api";
import { validateTimeRange } from "@/lib/format";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { buildSchedulePayload } from "@/lib/schedule-form-utils";
import { toScheduleResponse, updateScheduleInPattern } from "@/lib/trip-cache";

type EditScheduleDialogProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  schedule: ScheduleResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  maxEndDayOffset?: number;
  onShiftProposal?: (timeDelta: TimeDelta) => void;
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
  onShiftProposal,
}: EditScheduleDialogProps) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

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
  const [urls, setUrls] = useState<string[]>(schedule.urls ?? []);

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
      setUrls(schedule.urls ?? []);
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
      ...buildSchedulePayload(formData, {
        category,
        color,
        startTime,
        endTime,
        transportMethod,
        endDayOffset,
        urls,
      }),
      endDayOffset: endDayOffset > 0 ? endDayOffset : null,
      expectedUpdatedAt: schedule.updatedAt,
    };

    try {
      const result = await api<Record<string, unknown>>(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules/${schedule.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      );
      const prev = queryClient.getQueryData<TripResponse>(cacheKey);
      if (prev) {
        queryClient.setQueryData(
          cacheKey,
          updateScheduleInPattern(prev, dayId, patternId, schedule.id, toScheduleResponse(result)),
        );
      }
      const timeDelta = computeTimeDelta(schedule, {
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        endDayOffset: endDayOffset > 0 ? endDayOffset : null,
      });

      onOpenChange(false);
      toast.success(MSG.SCHEDULE_UPDATED);
      onUpdate();

      if (timeDelta && onShiftProposal) {
        onShiftProposal(timeDelta);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError(MSG.CONFLICT);
        onUpdate();
      } else if (err instanceof ApiError && err.status === 404) {
        toast.error(MSG.CONFLICT_DELETED);
        onOpenChange(false);
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
          <ScheduleFormFields
            category={category}
            onCategoryChange={setCategory}
            color={color}
            onColorChange={setColor}
            transportMethod={transportMethod}
            onTransportMethodChange={setTransportMethod}
            startTime={startTime}
            onStartTimeChange={setStartTime}
            endTime={endTime}
            onEndTimeChange={setEndTime}
            endDayOffset={endDayOffset}
            onEndDayOffsetChange={setEndDayOffset}
            maxEndDayOffset={maxEndDayOffset}
            timeError={timeError}
            urls={urls}
            onUrlsChange={setUrls}
            defaultValues={{
              name: schedule.name,
              address: schedule.address ?? "",
              departurePlace: schedule.departurePlace ?? "",
              arrivalPlace: schedule.arrivalPlace ?? "",
              memo: schedule.memo ?? "",
            }}
            idPrefix="edit-"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              <Check className="h-4 w-4" />
              {loading ? "更新中..." : "予定を更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
