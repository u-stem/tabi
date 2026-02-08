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
  address?: string | null;
  url?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  memo?: string | null;
  onDelete: () => void;
};

export function SpotItem({
  name,
  category,
  address,
  url,
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
    <div className="flex items-start gap-2 rounded-md border p-3">
      <span className="mt-0.5 shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="font-medium">{name}</span>
            {timeStr && (
              <span className="ml-2 text-xs text-muted-foreground">{timeStr}</span>
            )}
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="shrink-0 text-xs text-muted-foreground hover:text-destructive"
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
                <AlertDialogAction onClick={onDelete}>削除する</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {(address || url || memo) && (
          <div className="mt-1 space-y-0.5">
            {address && (
              <p className="text-xs text-muted-foreground">{address}</p>
            )}
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-xs text-blue-600 hover:underline"
              >
                {url}
              </a>
            )}
            {memo && <p className="text-sm text-muted-foreground">{memo}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
