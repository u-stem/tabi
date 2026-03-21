"use client";

import type { DayPatternResponse } from "@sugara/shared";
import { PATTERN_LABEL_MAX_LENGTH } from "@sugara/shared";
import { Check, ClipboardPaste, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
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
  const ts = useTranslations("schedule");
  const tc = useTranslations("common");
  return (
    <ResponsiveDialog open={patternOps.add.open} onOpenChange={patternOps.add.setOpen}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{ts("addPatternTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{ts("addPatternDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={patternOps.add.submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pattern-label">{ts("patternLabel")}</Label>
            <Input
              id="pattern-label"
              value={patternOps.add.label}
              onChange={(e) => patternOps.add.setLabel(e.target.value)}
              placeholder={ts("patternPlaceholder")}
              maxLength={PATTERN_LABEL_MAX_LENGTH}
            />
            <p className="text-right text-xs text-muted-foreground">
              {patternOps.add.label.length}/{PATTERN_LABEL_MAX_LENGTH}
            </p>
          </div>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                {tc("cancel")}
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={patternOps.add.loading || !patternOps.add.label.trim()}>
              <Plus className="h-4 w-4" />
              {patternOps.add.loading ? ts("adding") : ts("addButton")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function RenamePatternDialog({ patternOps }: { patternOps: PatternOps }) {
  const ts = useTranslations("schedule");
  const tc = useTranslations("common");
  return (
    <ResponsiveDialog
      open={patternOps.rename.target !== null}
      onOpenChange={patternOps.rename.setOpen}
    >
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{ts("renamePatternTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {ts("renamePatternDescription")}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={patternOps.rename.submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rename-label">{ts("patternLabel")}</Label>
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
                <X className="h-4 w-4" />
                {tc("cancel")}
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={!patternOps.rename.label.trim()}>
              <Check className="h-4 w-4" />
              {ts("change")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function DeletePatternDialog({ patternOps }: { patternOps: PatternOps }) {
  const ts = useTranslations("schedule");
  const tc = useTranslations("common");
  return (
    <ResponsiveAlertDialog
      open={patternOps.deleteTarget !== null}
      onOpenChange={(v) => !v && patternOps.setDeleteTarget(null)}
    >
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>{ts("deletePatternTitle")}</ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            {ts("deletePatternDescription", { name: patternOps.deleteTarget?.label ?? "" })}
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel>
            <X className="h-4 w-4" />
            {tc("cancel")}
          </ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogDestructiveAction
            onClick={() => {
              if (patternOps.deleteTarget) patternOps.handleDelete(patternOps.deleteTarget.id);
              patternOps.setDeleteTarget(null);
            }}
          >
            {tc("deletConfirm")}
          </ResponsiveAlertDialogDestructiveAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  );
}

export function OverwritePatternDialog({
  patternOps,
  patterns,
}: {
  patternOps: PatternOps;
  patterns: DayPatternResponse[];
}) {
  const ts = useTranslations("schedule");
  const tc = useTranslations("common");
  const source = patternOps.overwriteSource;
  const destinationOptions = patterns.filter((p) => p.id !== source?.id);
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);

  return (
    <ResponsiveDialog
      open={source !== null}
      onOpenChange={(open) => {
        if (!open) {
          patternOps.setOverwriteSource(null);
          setSelectedDestId(null);
        }
      }}
    >
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{ts("overwritePatternTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {ts("overwritePatternDescription", { name: source?.label ?? "" })}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="space-y-2">
          <Label>{ts("destinationPattern")}</Label>
          <div className="space-y-1">
            {destinationOptions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedDestId(p.id)}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  selectedDestId === p.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {selectedDestId === p.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                <span className="truncate">{p.label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {ts("itemCount", { count: p.schedules.length })}
                </span>
              </button>
            ))}
          </div>
        </div>
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose asChild>
            <Button type="button" variant="outline">
              <X className="h-4 w-4" />
              {tc("cancel")}
            </Button>
          </ResponsiveDialogClose>
          <Button
            disabled={!selectedDestId}
            onClick={() => {
              if (source && selectedDestId) {
                patternOps.handleOverwrite(selectedDestId, source.id);
                setSelectedDestId(null);
              }
            }}
          >
            <ClipboardPaste className="h-4 w-4" />
            {ts("overwriteButton")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function BatchDeleteDialog({ selection }: { selection: Selection }) {
  const ts = useTranslations("schedule");
  const tc = useTranslations("common");
  return (
    <ResponsiveAlertDialog
      open={selection.batchDeleteOpen}
      onOpenChange={selection.setBatchDeleteOpen}
    >
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>
            {ts("batchDeleteTitle", { count: selection.selectedIds.size })}
          </ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            {ts("batchDeleteDescription", { count: selection.selectedIds.size })}
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel>
            <X className="h-4 w-4" />
            {tc("cancel")}
          </ResponsiveAlertDialogCancel>
          <ResponsiveAlertDialogDestructiveAction
            onClick={selection.batchDelete}
            disabled={selection.batchLoading}
          >
            <Trash2 className="h-4 w-4" />
            {tc("deletConfirm")}
          </ResponsiveAlertDialogDestructiveAction>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  );
}
