"use client";

import { PATTERN_LABEL_MAX_LENGTH } from "@sugara/shared";
import { Check, Plus, Trash2 } from "lucide-react";
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
import type { usePatternOperations } from "@/lib/hooks/use-pattern-operations";
import type { useScheduleSelection } from "@/lib/hooks/use-schedule-selection";

type PatternOps = ReturnType<typeof usePatternOperations>;
type Selection = ReturnType<typeof useScheduleSelection>;

export function AddPatternDialog({ patternOps }: { patternOps: PatternOps }) {
  return (
    <ResponsiveDialog open={patternOps.add.open} onOpenChange={patternOps.add.setOpen}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>パターン追加</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>日程のパターンを追加します。</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
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
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={patternOps.add.loading || !patternOps.add.label.trim()}>
              <Plus className="h-4 w-4" />
              {patternOps.add.loading ? "追加中..." : "追加"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function RenamePatternDialog({ patternOps }: { patternOps: PatternOps }) {
  return (
    <ResponsiveDialog
      open={patternOps.rename.target !== null}
      onOpenChange={patternOps.rename.setOpen}
    >
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>パターン名変更</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>パターンのラベルを変更します。</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
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
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                キャンセル
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={!patternOps.rename.label.trim()}>
              <Check className="h-4 w-4" />
              変更
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
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
