"use client";

import { MAX_BOOKMARK_LISTS_PER_USER } from "@sugara/shared";
import { Copy, Globe, ListFilter, Lock, SquareMousePointer, Trash2, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { BookmarkListCard } from "@/components/bookmark-list-card";
import { CreateBookmarkListDialog } from "@/components/create-bookmark-list-dialog";
import { Fab } from "@/components/fab";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useBookmarkLists, type VisibilityFilter } from "@/lib/hooks/use-bookmark-lists";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

function SpBookmarksSkeleton() {
  return (
    <div className="mt-4">
      {/* Filter + selection buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 flex-1 rounded-md" />
      </div>
      {/* Bookmark list cards */}
      <div className="mt-4 grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpBookmarksPage() {
  const tm = useTranslations("messages");
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  const tlVis = useTranslations("labels.visibility");
  const online = useOnlineStatus();
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);

  const visibilityFilters: { value: VisibilityFilter; label: string; icon: React.ReactNode }[] = [
    { value: "all", label: tb("filterAll"), icon: <ListFilter className="h-4 w-4" /> },
    { value: "public", label: tb("filterPublic"), icon: <Globe className="h-4 w-4" /> },
    { value: "friends_only", label: tlVis("friends_only"), icon: <Users className="h-4 w-4" /> },
    { value: "private", label: tlVis("private"), icon: <Lock className="h-4 w-4" /> },
  ];

  const {
    bookmarkLists,
    filteredBookmarkLists,
    isLoading,
    error,
    visibilityFilter,
    setVisibilityFilter,
    createDialogOpen,
    setCreateDialogOpen,
    invalidateBookmarkLists,
    sel,
  } = useBookmarkLists(isGuest);

  const [visibilitySheetOpen, setVisibilitySheetOpen] = useState(false);

  useEffect(() => {
    document.title = pageTitle(tb("pageTitle"));
  }, []);

  if (isGuest) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <p className="text-sm text-muted-foreground">{tm("authGuestFeatureUnavailable")}</p>
        </div>
      </div>
    );
  }

  const errorFallback = error ? (
    <div className="mt-8 text-center">
      <p className="text-destructive">{tm("bookmarkListFetchFailed")}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => invalidateBookmarkLists()}
      >
        再試行
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <LoadingBoundary
        isLoading={isLoading}
        skeleton={<SpBookmarksSkeleton />}
        error={error}
        errorFallback={errorFallback}
      >
        <div className="mt-4">
          {sel.selectionMode ? (
            <div className="flex h-8 select-none items-center gap-1.5 rounded-lg bg-muted px-1.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={sel.exit}
                disabled={sel.batchLoading}
                aria-label={tc("endSelection")}
              >
                <X className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium">
                {tc("selectedCount", { count: sel.selectedIds.size })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={
                  sel.selectedIds.size === filteredBookmarkLists.length
                    ? sel.deselectAll
                    : sel.selectAll
                }
                disabled={sel.batchLoading}
              >
                {sel.selectedIds.size === filteredBookmarkLists.length
                  ? tc("deselectAll")
                  : tc("selectAll")}
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                  onClick={sel.handleBatchDuplicate}
                >
                  <Copy className="h-4 w-4" />
                  {tc("duplicate")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive"
                  disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                  onClick={() => sel.setBatchDeleteOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {tc("delete")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={tb("filterByVisibility")}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setVisibilitySheetOpen(true);
                }}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border bg-background px-2 text-xs"
              >
                {visibilityFilters.find((f) => f.value === visibilityFilter)?.icon}
                {visibilityFilters.find((f) => f.value === visibilityFilter)?.label ??
                  tb("filterAll")}
              </button>
              <ActionSheet
                open={visibilitySheetOpen}
                onOpenChange={setVisibilitySheetOpen}
                actions={visibilityFilters.map((f) => ({
                  label: f.label,
                  icon: f.icon,
                  onClick: () => setVisibilityFilter(f.value),
                }))}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 flex-1"
                onClick={sel.enter}
                disabled={!online || filteredBookmarkLists.length === 0}
                aria-label={tc("selectionMode")}
              >
                <SquareMousePointer className="h-4 w-4" />
                {tc("select")}
              </Button>
            </div>
          )}
        </div>
        {bookmarkLists.length === 0 ? (
          <EmptyState message={tm("emptyBookmarkList")} variant="page" />
        ) : filteredBookmarkLists.length === 0 ? (
          <EmptyState message={tm("emptyBookmarkListFilter")} variant="page" />
        ) : (
          <div className="mt-4 grid gap-4">
            {filteredBookmarkLists.map((list) => (
              <BookmarkListCard
                key={list.id}
                {...list}
                hrefPrefix="/sp/bookmarks"
                selectable={sel.selectionMode}
                selected={sel.selectedIds.has(list.id)}
                onSelect={sel.toggle}
              />
            ))}
          </div>
        )}
      </LoadingBoundary>
      <ResponsiveAlertDialog open={sel.batchDeleteOpen} onOpenChange={sel.setBatchDeleteOpen}>
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>
              {tb("batchDeleteTitle", { count: sel.selectedIds.size })}
            </ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              {tb("batchDeleteDescription")}
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              {tc("cancel")}
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction onClick={sel.handleBatchDelete}>
              <Trash2 className="h-4 w-4" />
              {tb("deleteConfirm")}
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
      <CreateBookmarkListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={invalidateBookmarkLists}
      />
      <Fab
        onClick={() => {
          if (bookmarkLists.length >= MAX_BOOKMARK_LISTS_PER_USER) {
            toast.info(tm("limitBookmarkLists"));
            return;
          }
          setCreateDialogOpen(true);
        }}
        label={tb("createListFab")}
        hidden={!online || sel.selectionMode}
      />
    </>
  );
}
