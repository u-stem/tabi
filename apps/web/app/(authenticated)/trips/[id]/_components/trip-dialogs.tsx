"use client";

import type { CandidateResponse, TripResponse } from "@sugara/shared";
import { PATTERN_LABEL_MAX_LENGTH } from "@sugara/shared";
import { Check, Plus, Trash2 } from "lucide-react";
import { ActivityLog } from "@/components/activity-log";
import { BookmarkPanel } from "@/components/bookmark-panel";
import { CandidatePanel } from "@/components/candidate-panel";
import { ExpensePanel } from "@/components/expense-panel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { usePatternOperations } from "@/lib/hooks/use-pattern-operations";
import type { useScheduleSelection } from "@/lib/hooks/use-schedule-selection";
import type { RightPanelTab } from "./right-panel-tabs";
import { RightPanelTabs } from "./right-panel-tabs";

type PatternOps = ReturnType<typeof usePatternOperations>;
type Selection = ReturnType<typeof useScheduleSelection>;

export function AddPatternDialog({ patternOps }: { patternOps: PatternOps }) {
  return (
    <Dialog open={patternOps.add.open} onOpenChange={patternOps.add.setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>パターン追加</DialogTitle>
          <DialogDescription>日程のパターンを追加します。</DialogDescription>
        </DialogHeader>
        <form onSubmit={patternOps.add.submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pattern-label">ラベル</Label>
            <Input
              id="pattern-label"
              value={patternOps.add.label}
              onChange={(e) => patternOps.add.setLabel(e.target.value)}
              placeholder="例: 雨の日プラン"
              maxLength={PATTERN_LABEL_MAX_LENGTH}
            />
            <p className="text-right text-xs text-muted-foreground">
              {patternOps.add.label.length}/{PATTERN_LABEL_MAX_LENGTH}
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </DialogClose>
            <Button type="submit" disabled={patternOps.add.loading || !patternOps.add.label.trim()}>
              <Plus className="h-4 w-4" />
              {patternOps.add.loading ? "追加中..." : "追加"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RenamePatternDialog({ patternOps }: { patternOps: PatternOps }) {
  return (
    <Dialog open={patternOps.rename.target !== null} onOpenChange={patternOps.rename.setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>パターン名変更</DialogTitle>
          <DialogDescription>パターンのラベルを変更します。</DialogDescription>
        </DialogHeader>
        <form onSubmit={patternOps.rename.submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-label">ラベル</Label>
            <Input
              id="rename-label"
              value={patternOps.rename.label}
              onChange={(e) => patternOps.rename.setLabel(e.target.value)}
              maxLength={PATTERN_LABEL_MAX_LENGTH}
            />
            <p className="text-right text-xs text-muted-foreground">
              {patternOps.rename.label.length}/{PATTERN_LABEL_MAX_LENGTH}
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </DialogClose>
            <Button type="submit" disabled={!patternOps.rename.label.trim()}>
              <Check className="h-4 w-4" />
              変更
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeletePatternDialog({ patternOps }: { patternOps: PatternOps }) {
  return (
    <AlertDialog
      open={patternOps.deleteTarget !== null}
      onOpenChange={(v) => !v && patternOps.setDeleteTarget(null)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>パターンを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            「{patternOps.deleteTarget?.label}
            」とその中のすべての予定を削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogDestructiveAction
            onClick={() => {
              if (patternOps.deleteTarget) patternOps.handleDelete(patternOps.deleteTarget.id);
              patternOps.setDeleteTarget(null);
            }}
          >
            削除する
          </AlertDialogDestructiveAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BatchDeleteDialog({ selection }: { selection: Selection }) {
  return (
    <AlertDialog open={selection.batchDeleteOpen} onOpenChange={selection.setBatchDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{selection.selectedIds.size}件を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            選択した{selection.selectedIds.size}件を削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogDestructiveAction
            onClick={selection.batchDelete}
            disabled={selection.batchLoading}
          >
            <Trash2 className="h-4 w-4" />
            削除する
          </AlertDialogDestructiveAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MobileCandidateDialog({
  open,
  onOpenChange,
  rightPanelTab,
  setRightPanelTab,
  tripId,
  candidates,
  currentDay,
  currentPatternId,
  onRefresh,
  disabled,
  scheduleLimitReached,
  scheduleLimitMessage,
  maxEndDayOffset,
  onSaveToBookmark,
  canEdit,
  hasDays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rightPanelTab: RightPanelTab;
  setRightPanelTab: (tab: RightPanelTab) => void;
  tripId: string;
  candidates: CandidateResponse[];
  currentDay: TripResponse["days"][number] | null;
  currentPatternId: string | null;
  onRefresh: () => void;
  disabled: boolean;
  scheduleLimitReached: boolean;
  scheduleLimitMessage: string;
  maxEndDayOffset: number;
  onSaveToBookmark?: (scheduleIds: string[]) => void;
  canEdit: boolean;
  hasDays: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-sm">
        <DialogTitle className="sr-only">候補・ブックマーク・履歴</DialogTitle>
        <RightPanelTabs
          current={rightPanelTab}
          onChange={setRightPanelTab}
          candidateCount={candidates.length}
        />
        <div className="min-h-0 overflow-y-auto">
          {rightPanelTab === "candidates" ? (
            currentDay && currentPatternId ? (
              <CandidatePanel
                tripId={tripId}
                candidates={candidates}
                currentDayId={currentDay.id}
                currentPatternId={currentPatternId}
                onRefresh={onRefresh}
                disabled={disabled}
                draggable={false}
                scheduleLimitReached={scheduleLimitReached}
                scheduleLimitMessage={scheduleLimitMessage}
                maxEndDayOffset={maxEndDayOffset}
                onSaveToBookmark={onSaveToBookmark}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {hasDays
                  ? "日タブを選択すると候補を追加できます"
                  : "日程が確定すると候補を追加できます"}
              </p>
            )
          ) : rightPanelTab === "bookmarks" ? (
            hasDays ? (
              <div className="p-4">
                <BookmarkPanel tripId={tripId} disabled={disabled} onCandidateAdded={onRefresh} />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                日程が確定するとブックマークを利用できます
              </p>
            )
          ) : rightPanelTab === "expenses" ? (
            hasDays ? (
              <div className="p-4">
                <ExpensePanel tripId={tripId} canEdit={canEdit} />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                日程が確定すると費用を記録できます
              </p>
            )
          ) : (
            <div className="p-4">
              <ActivityLog tripId={tripId} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
