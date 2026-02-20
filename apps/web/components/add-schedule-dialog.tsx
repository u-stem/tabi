"use client";

import type {
  ScheduleCategory,
  ScheduleColor,
  TransportMethod,
  TripResponse,
} from "@sugara/shared";
import { DEFAULT_SCHEDULE_CATEGORY } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ScheduleFormFields } from "@/components/schedule-form-fields";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { api, getApiErrorMessage } from "@/lib/api";
import { validateTimeRange } from "@/lib/format";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { buildSchedulePayload } from "@/lib/schedule-form-utils";
import { addScheduleToPattern, toScheduleResponse } from "@/lib/trip-cache";

type AddScheduleDialogProps = {
  tripId: string;
  dayId: string;
  patternId: string;
  onAdd: () => void;
  disabled?: boolean;
  maxEndDayOffset?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AddScheduleDialog({
  tripId,
  dayId,
  patternId,
  onAdd,
  disabled,
  maxEndDayOffset = 0,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddScheduleDialogProps) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<ScheduleCategory>(DEFAULT_SCHEDULE_CATEGORY);
  const [transportMethod, setTransportMethod] = useState<TransportMethod | "">("");
  const [color, setColor] = useState<ScheduleColor>("blue");
  const [startTime, setStartTime] = useState<string | undefined>();
  const [endTime, setEndTime] = useState<string | undefined>();
  const [endDayOffset, setEndDayOffset] = useState(0);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [urls, setUrls] = useState<string[]>([]);

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
    const data = buildSchedulePayload(formData, {
      category,
      color,
      startTime,
      endTime,
      transportMethod,
      endDayOffset,
      urls,
    });

    try {
      const result = await api<Record<string, unknown>>(
        `/api/trips/${tripId}/days/${dayId}/patterns/${patternId}/schedules`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      );
      const prev = queryClient.getQueryData<TripResponse>(cacheKey);
      if (prev) {
        queryClient.setQueryData(
          cacheKey,
          addScheduleToPattern(prev, dayId, patternId, toScheduleResponse(result)),
        );
      }
      setOpen(false);
      toast.success(MSG.SCHEDULE_ADDED);
      onAdd();
    } catch (err) {
      setError(getApiErrorMessage(err, MSG.SCHEDULE_ADD_FAILED));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveDialog
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
          setUrls([]);
        }
      }}
    >
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Plus className="h-4 w-4" />
          予定を追加
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>予定を追加</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>旅行の日程に予定を追加します</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
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
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <ResponsiveDialogFooter>
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "追加中..." : "予定を追加"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
