"use client";

import { BookmarkPanel } from "@/components/bookmark-panel";

type BookmarkTabProps = {
  tripId: string;
  disabled: boolean;
  hasDays: boolean;
  onCandidateAdded: () => void;
};

export function BookmarkTab({ tripId, disabled, hasDays, onCandidateAdded }: BookmarkTabProps) {
  if (!hasDays) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        日程が確定するとブックマークを利用できます
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-card p-4">
      <BookmarkPanel tripId={tripId} disabled={disabled} onCandidateAdded={onCandidateAdded} />
    </div>
  );
}
