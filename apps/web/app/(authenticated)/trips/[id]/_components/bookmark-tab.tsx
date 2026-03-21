"use client";

import { useTranslations } from "next-intl";
import { memo } from "react";
import { BookmarkPanel } from "@/components/bookmark-panel";

type BookmarkTabProps = {
  tripId: string;
  disabled: boolean;
  hasDays: boolean;
  onCandidateAdded: () => void;
};

export const BookmarkTab = memo(function BookmarkTab({
  tripId,
  disabled,
  hasDays,
  onCandidateAdded,
}: BookmarkTabProps) {
  const tsch = useTranslations("schedule");
  if (!hasDays) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {tsch("schedulesNotAvailable", { feature: tsch("bookmarks") })}
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <BookmarkPanel tripId={tripId} disabled={disabled} onCandidateAdded={onCandidateAdded} />
    </div>
  );
});
