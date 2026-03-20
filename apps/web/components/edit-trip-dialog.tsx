"use client";

import { TRIP_DESTINATION_MAX_LENGTH, TRIP_TITLE_MAX_LENGTH } from "@sugara/shared";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CoverImagePicker } from "@/components/cover-image-picker";
import { DateRangePicker } from "@/components/date-range-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { api, getApiErrorMessage } from "@/lib/api";
import { getDayCount } from "@/lib/format";
import { useCoverImageUpload } from "@/lib/hooks/use-cover-image-upload";

type EditTripDialogProps = {
  tripId: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  coverImageUrl: string | null;
  coverImagePosition: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
};

export function EditTripDialog({
  tripId,
  title,
  destination,
  startDate,
  endDate,
  coverImageUrl,
  coverImagePosition,
  open,
  onOpenChange,
  onUpdate,
}: EditTripDialogProps) {
  const tm = useTranslations("messages");
  const tt = useTranslations("trip");
  const tc = useTranslations("common");
  const [editTitle, setEditTitle] = useState(title);
  const [editDestination, setEditDestination] = useState(destination ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDates = startDate != null && endDate != null;
  const [editStartDate, setEditStartDate] = useState(startDate ?? "");
  const [editEndDate, setEditEndDate] = useState(endDate ?? "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [editPosition, setEditPosition] = useState(coverImagePosition);
  const [removeCover, setRemoveCover] = useState(false);
  const { uploading, error: uploadError, upload, remove } = useCoverImageUpload();

  useEffect(() => {
    if (open) {
      setEditTitle(title);
      setEditDestination(destination ?? "");
      setEditStartDate(startDate ?? "");
      setEditEndDate(endDate ?? "");
      setCoverFile(null);
      setEditPosition(coverImagePosition);
      setRemoveCover(false);
    }
  }, [open, title, destination, startDate, endDate, coverImagePosition]);

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const newStartDate = formData.get("startDate") as string;
    const newEndDate = formData.get("endDate") as string;

    if (hasDates && (!newStartDate || !newEndDate)) {
      setError(tm("tripDateRequired"));
      setLoading(false);
      return;
    }

    if (hasDates && newStartDate && newEndDate && startDate && endDate) {
      const oldCount = getDayCount(startDate, endDate);
      const newCount = getDayCount(newStartDate, newEndDate);
      if (newCount < oldCount) {
        setError(tm("tripDaysReduced"));
        setLoading(false);
        return;
      }
    }

    let newCoverImageUrl: string | null | undefined;
    if (coverFile) {
      // Upload API deletes old image and updates DB
      const url = await upload(tripId, coverFile);
      if (!url) {
        setLoading(false);
        return;
      }
      newCoverImageUrl = url;
    } else if (removeCover && coverImageUrl) {
      await remove(tripId);
      newCoverImageUrl = null;
    }

    const rawDestination = (formData.get("destination") as string).trim();
    const data: Record<string, unknown> = {
      title: formData.get("title") as string,
      destination: rawDestination || null,
    };
    if (newStartDate && newEndDate) {
      data.startDate = newStartDate;
      data.endDate = newEndDate;
    }
    if (newCoverImageUrl !== undefined) {
      data.coverImageUrl = newCoverImageUrl;
    }
    if (editPosition !== coverImagePosition) {
      data.coverImagePosition = editPosition;
    }

    try {
      await api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      onOpenChange(false);
      toast.success(tm("tripUpdated"));
      onUpdate();
    } catch (err) {
      setError(getApiErrorMessage(err, tm("tripUpdateFailed")));
    } finally {
      setLoading(false);
    }
  }

  const busy = loading || uploading;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tt("editTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{tt("editDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="space-y-4 overflow-y-auto px-1">
            <div className="space-y-2">
              <Label htmlFor="edit-title">
                {tt("title")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-title"
                name="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={tt("tripTitlePlaceholder")}
                maxLength={TRIP_TITLE_MAX_LENGTH}
                required
              />
              <p className="text-right text-xs text-muted-foreground">
                {editTitle.length}/{TRIP_TITLE_MAX_LENGTH}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-destination">{tt("destination")}</Label>
              <Input
                id="edit-destination"
                name="destination"
                value={editDestination}
                onChange={(e) => setEditDestination(e.target.value)}
                placeholder={tt("destinationPlaceholder")}
                maxLength={TRIP_DESTINATION_MAX_LENGTH}
              />
              <p className="text-right text-xs text-muted-foreground">
                {editDestination.length}/{TRIP_DESTINATION_MAX_LENGTH}
              </p>
            </div>
            <CoverImagePicker
              imageUrl={removeCover ? null : coverImageUrl}
              previewFile={coverFile}
              position={editPosition}
              onFileSelect={(file) => {
                setCoverFile(file);
                setRemoveCover(false);
              }}
              onPositionChange={setEditPosition}
              onRemove={() => {
                setCoverFile(null);
                setRemoveCover(true);
              }}
              disabled={busy}
            />
            {uploadError && (
              <p role="alert" className="text-sm text-destructive">
                {uploadError}
              </p>
            )}
            {hasDates && (
              <div className="space-y-2">
                <Label>
                  {tt("period")} <span className="text-destructive">*</span>
                </Label>
                <DateRangePicker
                  startDate={editStartDate}
                  endDate={editEndDate}
                  onChangeStart={setEditStartDate}
                  onChangeEnd={setEditEndDate}
                />
                <input type="hidden" name="startDate" value={editStartDate} />
                <input type="hidden" name="endDate" value={editEndDate} />
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <ResponsiveDialogFooter className="shrink-0 border-t pt-4">
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                {tc("cancel")}
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={busy}>
              <Check className="h-4 w-4" />
              {busy ? tt("updating") : tc("update")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
