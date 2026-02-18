"use client";

import { DAY_MEMO_MAX_LENGTH } from "@sugara/shared";
import { Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { useDayMemo } from "@/lib/hooks/use-day-memo";
import { cn } from "@/lib/utils";

type Memo = ReturnType<typeof useDayMemo>;

export function DayMemoEditor({
  memo,
  currentDayId,
  currentDayMemo,
  canEdit,
  online,
}: {
  memo: Memo;
  currentDayId: string;
  currentDayMemo: string | null | undefined;
  canEdit: boolean;
  online: boolean;
}) {
  return (
    <div className="mb-3">
      {memo.editingDayId === currentDayId ? (
        <div className="space-y-2">
          <Textarea
            value={memo.text}
            onChange={(e) => memo.setText(e.target.value)}
            placeholder="メモを入力..."
            maxLength={DAY_MEMO_MAX_LENGTH}
            rows={3}
            className="resize-none text-sm"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {memo.text.length}/{DAY_MEMO_MAX_LENGTH}
            </span>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={memo.cancelEdit} disabled={memo.saving}>
                キャンセル
              </Button>
              <Button size="sm" onClick={memo.save} disabled={memo.saving}>
                <Check className="h-3.5 w-3.5" />
                {memo.saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            canEdit && online ? memo.startEdit(currentDayId, currentDayMemo) : undefined
          }
          className={cn(
            "flex w-full select-none items-start gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors",
            canEdit && online
              ? "cursor-pointer hover:border-border hover:bg-muted/50"
              : "cursor-default",
            currentDayMemo
              ? "border-border text-foreground"
              : "border-muted-foreground/20 text-muted-foreground",
          )}
        >
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-pre-wrap">{currentDayMemo || "メモを追加"}</span>
        </button>
      )}
    </div>
  );
}
