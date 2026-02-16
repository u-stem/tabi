"use client";

import type { ScheduleColor, ScheduleResponse, TransportMethod } from "@sugara/shared";
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
import { buildSchedulePayload } from "@/lib/schedule-form-utils";

type EditCandidateDialogProps = {
  tripId: string;
  schedule: ScheduleResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  maxEndDayOffset?: number;
};

export function EditCandidateDialog({
  tripId,
  schedule,
  open,
  onOpenChange,
  onUpdate,
  maxEndDayOffset = 0,
}: EditCandidateDialogProps) {
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
      ...buildSchedulePayload(formData, {
        category,
        color,
        startTime,
        endTime,
        transportMethod,
        endDayOffset,
      }),
      endDayOffset: endDayOffset > 0 ? endDayOffset : null,
      expectedUpdatedAt: schedule.updatedAt,
    };

    try {
      await api(`/api/trips/${tripId}/candidates/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      onOpenChange(false);
      toast.success(MSG.CANDIDATE_UPDATED);
      onUpdate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(MSG.CONFLICT);
        onOpenChange(false);
        onUpdate();
      } else if (err instanceof ApiError && err.status === 404) {
        toast.error(MSG.CONFLICT_DELETED);
        onOpenChange(false);
        onUpdate();
      } else {
        setError(err instanceof Error ? err.message : MSG.CANDIDATE_UPDATE_FAILED);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>候補を編集</DialogTitle>
          <DialogDescription>候補の情報を変更します</DialogDescription>
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
            defaultValues={{
              name: schedule.name,
              address: schedule.address ?? "",
              url: schedule.url ?? "",
              departurePlace: schedule.departurePlace ?? "",
              arrivalPlace: schedule.arrivalPlace ?? "",
              memo: schedule.memo ?? "",
            }}
            idPrefix="edit-candidate-"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              <Check className="h-4 w-4" />
              {loading ? "更新中..." : "更新"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
