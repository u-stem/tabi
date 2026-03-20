"use client";

import type { BookmarkListResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type BookmarkListPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (listId: string) => void;
};

export function BookmarkListPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: BookmarkListPickerDialogProps) {
  const tb = useTranslations("bookmark");
  const tm = useTranslations("messages");
  const tc = useTranslations("common");
  const { data: lists = [], isLoading } = useQuery({
    queryKey: queryKeys.bookmarks.lists(),
    queryFn: () => api<BookmarkListResponse[]>("/api/bookmark-lists"),
    enabled: open,
  });
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tb("pickerTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{tb("pickerDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="max-h-60 overflow-y-auto">
          <LoadingBoundary
            isLoading={isLoading}
            skeleton={
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            }
          >
            {lists.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">{tm("emptyBookmarkList")}</p>
                <Link
                  href="/bookmarks"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  {tb("createOnBookmarkPage")}
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => {
                      onSelect(list.id);
                      onOpenChange(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{list.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {tb("countSuffix", { count: list.bookmarkCount })}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </LoadingBoundary>
        </div>
        <ResponsiveDialogFooter>
          <ResponsiveDialogClose asChild>
            <Button type="button" variant="outline">
              <X className="h-4 w-4" />
              {tc("cancel")}
            </Button>
          </ResponsiveDialogClose>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
