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
} from "@/components/ui/responsive-dialog";
import { api } from "@/lib/api";
import { validateTimeRange } from "@/lib/format";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { buildSchedulePayload } from "@/lib/schedule-form-utils";
import { addCandidate, toCandidateResponse } from "@/lib/trip-cache";

type AddCandidateDialogProps = {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  maxEndDayOffset?: number;
};

export function AddCandidateDialog({
  tripId,
  open,
  onOpenChange,
  onAdd,
  maxEndDayOffset = 0,
}: AddCandidateDialogProps) {
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);

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
      const result = await api<Record<string, unknown>>(`/api/trips/${tripId}/candidates`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      const prev = queryClient.getQueryData<TripResponse>(cacheKey);
      if (prev) {
        queryClient.setQueryData(cacheKey, addCandidate(prev, toCandidateResponse(result)));
      }
      onOpenChange(false);
      toast.success(MSG.CANDIDATE_ADDED);
      onAdd();
    } catch {
      setError(MSG.CANDIDATE_ADD_FAILED);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
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
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>候補を追加</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            気になる場所を候補に追加しましょう
          </ResponsiveDialogDescription>
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
            idPrefix="candidate-"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <ResponsiveDialogFooter>
            <Button type="submit" disabled={loading}>
              <Plus className="h-4 w-4" />
              {loading ? "追加中..." : "追加"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
