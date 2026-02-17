"use client";

import type { CandidateResponse, TripResponse } from "@sugara/shared";
import { PATTERN_LABEL_MAX_LENGTH } from "@sugara/shared";
import { Check, Plus, Trash2 } from "lucide-react";
import { ActivityLog } from "@/components/activity-log";
import { CandidatePanel } from "@/components/candidate-panel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { usePatternOperations } from "@/lib/hooks/use-pattern-operations";
import type { useScheduleSelection } from "@/lib/hooks/use-schedule-selection";
import { cn } from "@/lib/utils";

type PatternOps = ReturnType<typeof usePatternOperations>;
type Selection = ReturnType<typeof useScheduleSelection>;

export function AddPatternDialog({ patternOps }: { patternOps: PatternOps }) {
  return (
    <Dialog open={patternOps.add.open} onOpenChange={patternOps.add.setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>パターン追加</DialogTitle>
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
            <Button
              type="submit"
              disabled={patternOps.rename.loading || !patternOps.rename.label.trim()}
            >
              <Check className="h-4 w-4" />
              {patternOps.rename.loading ? "変更中..." : "変更"}
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
          <AlertDialogAction
            onClick={() => {
              if (patternOps.deleteTarget) patternOps.handleDelete(patternOps.deleteTarget.id);
              patternOps.setDeleteTarget(null);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            削除する
          </AlertDialogAction>
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
          <AlertDialogAction
            onClick={selection.batchDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={selection.batchLoading}
          >
            <Trash2 className="h-4 w-4" />
            削除する
          </AlertDialogAction>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rightPanelTab: "candidates" | "activity";
  setRightPanelTab: (tab: "candidates" | "activity") => void;
  tripId: string;
  candidates: CandidateResponse[];
  currentDay: TripResponse["days"][number] | null;
  currentPatternId: string | null;
  onRefresh: () => void;
  disabled: boolean;
  scheduleLimitReached: boolean;
  scheduleLimitMessage: string;
  maxEndDayOffset: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-sm">
        <DialogTitle className="sr-only">候補・履歴</DialogTitle>
        <div className="flex shrink-0 select-none border-b" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === "candidates"}
            onClick={() => setRightPanelTab("candidates")}
            className={cn(
              "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
              rightPanelTab === "candidates"
                ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            候補
            {candidates.length > 0 && (
              <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{candidates.length}</span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={rightPanelTab === "activity"}
            onClick={() => setRightPanelTab("activity")}
            className={cn(
              "relative shrink-0 px-4 py-2 text-sm font-medium transition-colors",
              rightPanelTab === "activity"
                ? "text-blue-600 dark:text-blue-400 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-600 dark:after:bg-blue-400"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            履歴
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto">
          {rightPanelTab === "candidates" ? (
            currentDay &&
            currentPatternId && (
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
              />
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
