"use client";

import { CATEGORY_LABELS } from "@tabi/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type SpotItemProps = {
  name: string;
  category: string;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  onDelete: () => void;
};

export function SpotItem({
  name,
  category,
  startTime,
  endTime,
  memo,
  onDelete,
}: SpotItemProps) {
  const timeStr =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime
        ? startTime
        : "";

  return (
    <div className="flex items-start gap-3 rounded-md border p-3">
      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-medium">{name}</span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="text-xs text-muted-foreground hover:text-destructive"
                aria-label={`${name}を削除`}
              >
                削除
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>スポットを削除しますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  「{name}」を削除します。この操作は取り消せません。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  削除する
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {timeStr && (
          <p className="text-xs text-muted-foreground">{timeStr}</p>
        )}
        {memo && (
          <p className="mt-1 text-sm text-muted-foreground">{memo}</p>
        )}
      </div>
    </div>
  );
}
