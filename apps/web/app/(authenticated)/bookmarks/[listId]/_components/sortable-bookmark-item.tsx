"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BookmarkResponse } from "@sugara/shared";
import { ExternalLink, MoreHorizontal, Pencil, StickyNote, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { DragHandle } from "@/components/drag-handle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function BookmarkItemContent({ bm, asLink }: { bm: BookmarkResponse; asLink?: boolean }) {
  const urls = bm.urls ?? [];
  return (
    <div className="min-w-0 flex-1">
      <span className="break-words font-medium text-sm">{bm.name}</span>
      {urls.length > 0 &&
        urls.map((url) =>
          asLink ? (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            </a>
          ) : (
            <p
              key={url}
              className="mt-1 flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
            </p>
          ),
        )}
      {bm.memo && (
        <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
          <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/70" />
          <p className="whitespace-pre-line">{bm.memo}</p>
        </div>
      )}
    </div>
  );
}

export function SortableBookmarkItem({
  bm,
  onEdit,
  onDelete,
}: {
  bm: BookmarkResponse;
  onEdit: (bm: BookmarkResponse) => void;
  onDelete: (bm: BookmarkResponse) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bm.id,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex shrink-0 items-center pt-0.5">
        <DragHandle attributes={attributes} listeners={listeners} />
      </div>
      <BookmarkItemContent bm={bm} asLink />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`${bm.name}のメニュー`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(bm)}>
            <Pencil />
            編集
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(bm)}>
            <Trash2 />
            削除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
