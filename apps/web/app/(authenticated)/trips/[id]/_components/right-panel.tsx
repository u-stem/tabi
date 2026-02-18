"use client";

import type { CandidateResponse } from "@sugara/shared";
import { ActivityLog } from "@/components/activity-log";
import { BookmarkPanel } from "@/components/bookmark-panel";
import { CandidatePanel } from "@/components/candidate-panel";
import { type RightPanelTab, RightPanelTabs } from "./right-panel-tabs";

export type { RightPanelTab };

export function RightPanel({
  tripId,
  rightPanelTab,
  setRightPanelTab,
  candidates,
  currentDayId,
  currentPatternId,
  onRefresh,
  disabled,
  canEdit,
  online,
  addCandidateOpen,
  onAddCandidateOpenChange,
  scheduleLimitReached,
  scheduleLimitMessage,
  overCandidateId,
  maxEndDayOffset,
  onSaveToBookmark,
}: {
  tripId: string;
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  candidates: CandidateResponse[];
  currentDayId: string;
  currentPatternId: string;
  onRefresh: () => Promise<void>;
  disabled: boolean;
  canEdit: boolean;
  online: boolean;
  addCandidateOpen: boolean;
  onAddCandidateOpenChange: (open: boolean) => void;
  scheduleLimitReached: boolean;
  scheduleLimitMessage: string;
  overCandidateId: string | null;
  maxEndDayOffset: number;
  onSaveToBookmark?: (scheduleIds: string[]) => void;
}) {
  return (
    <div className="hidden max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-12rem)] lg:flex min-w-0 flex-[2] flex-col rounded-lg border border-dashed bg-card self-start sticky top-4">
      <RightPanelTabs
        current={rightPanelTab}
        onChange={setRightPanelTab}
        candidateCount={candidates.length}
      />
      <div className="min-h-0 overflow-y-auto p-4">
        {rightPanelTab === "candidates" ? (
          <CandidatePanel
            tripId={tripId}
            candidates={candidates}
            currentDayId={currentDayId}
            currentPatternId={currentPatternId}
            onRefresh={onRefresh}
            disabled={disabled}
            draggable={canEdit && online}
            addDialogOpen={addCandidateOpen}
            onAddDialogOpenChange={onAddCandidateOpenChange}
            scheduleLimitReached={scheduleLimitReached}
            scheduleLimitMessage={scheduleLimitMessage}
            overCandidateId={overCandidateId}
            maxEndDayOffset={maxEndDayOffset}
            onSaveToBookmark={onSaveToBookmark}
          />
        ) : rightPanelTab === "bookmarks" ? (
          <BookmarkPanel tripId={tripId} disabled={disabled} onCandidateAdded={onRefresh} />
        ) : (
          <ActivityLog tripId={tripId} />
        )}
      </div>
    </div>
  );
}
