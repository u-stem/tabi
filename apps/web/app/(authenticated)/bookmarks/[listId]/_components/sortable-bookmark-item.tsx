"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { BookmarkResponse } from "@sugara/shared";
import { ExternalLink, Pencil, StickyNote, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { ActionSheet } from "@/components/action-sheet";
import { DragHandle } from "@/components/drag-handle";
import { ItemMenuButton } from "@/components/item-menu-button";
import { SwipeableCard } from "@/components/swipeable-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stripProtocol } from "@/lib/format";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
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
              <span className="truncate">{stripProtocol(url)}</span>
            </a>
          ) : (
            <p
              key={url}
              className="mt-1 flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{stripProtocol(url)}</span>
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
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bm.id,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const canSwipe = isMobile;

  const cardContent = (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm",
        isDragging && "opacity-50",
      )}
    >
      <div className="flex h-5 shrink-0 items-center">
        <DragHandle attributes={attributes} listeners={listeners} />
      </div>
      <BookmarkItemContent bm={bm} asLink />
      {isMobile ? (
        <>
          <ItemMenuButton ariaLabel={`${bm.name}のメニュー`} onClick={() => setSheetOpen(true)} />
          <ActionSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            actions={[
              {
                label: "編集",
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => onEdit(bm),
              },
              {
                label: "削除",
                icon: <Trash2 className="h-4 w-4" />,
                onClick: () => onDelete(bm),
                variant: "destructive" as const,
              },
            ]}
          />
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ItemMenuButton ariaLabel={`${bm.name}のメニュー`} />
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
      )}
    </div>
  );

  return (
    <div ref={setNodeRef} style={style}>
      {canSwipe ? (
        <SwipeableCard
          actions={[
            {
              label: "編集",
              icon: <Pencil className="h-4 w-4" />,
              color: "blue" as const,
              onClick: () => onEdit(bm),
            },
            {
              label: "削除",
              icon: <Trash2 className="h-4 w-4" />,
              color: "red" as const,
              onClick: () => onDelete(bm),
            },
          ]}
        >
          {cardContent}
        </SwipeableCard>
      ) : (
        cardContent
      )}
    </div>
  );
}
