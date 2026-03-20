"use client";

import { MAX_BOOKMARK_LISTS_PER_USER } from "@sugara/shared";
import {
  Copy,
  Globe,
  ListFilter,
  Lock,
  MoreHorizontal,
  Plus,
  SquareMousePointer,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type React from "react";
import { useEffect, useMemo } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { BookmarkListCard } from "@/components/bookmark-list-card";
import { CreateBookmarkListDialog } from "@/components/create-bookmark-list-dialog";
import { Fab } from "@/components/fab";
import type { ShortcutGroup } from "@/components/shortcut-help-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isGuestUser } from "@/lib/guest";
import { useBookmarkLists, type VisibilityFilter } from "@/lib/hooks/use-bookmark-lists";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";
import { isDialogOpen } from "@/lib/hotkeys";
import { useRegisterShortcuts, useShortcutHelp } from "@/lib/shortcut-help-context";

function BookmarksSkeleton() {
  return (
    <div>
      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-8 w-[100px]" />
        <div className="flex items-center gap-2 ml-auto">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
          <div key={key} className="rounded-lg border bg-card shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="p-6 pt-0">
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  const tm = useTranslations("messages");
  const tb = useTranslations("bookmark");
  const tc = useTranslations("common");
  const tlVis = useTranslations("labels.visibility");
  const tsc = useTranslations("shortcuts");
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

  const { open: openShortcutHelp } = useShortcutHelp();
  const shortcuts: ShortcutGroup[] = useMemo(
    () => [
      {
        group: tsc("general"),
        items: [
          { key: "n", description: tsc("create") },
          { key: "s", description: tsc("toggleSelection") },
          { key: "Escape", description: tsc("exitSelection") },
          { key: "a", description: tsc("toggleSelectAll") },
        ],
      },
    ],
    [tsc],
  );
  useRegisterShortcuts(shortcuts);

  useEffect(() => {
    document.title = pageTitle(tb("pageTitle"));
  }, []);

  useHotkeys("?", () => openShortcutHelp(), { useKey: true, preventDefault: true });
  useHotkeys(
    "n",
    () => {
      if (!isDialogOpen()) setCreateDialogOpen(true);
    },
    { preventDefault: true },
  );
  useHotkeys(
    "s",
    () => {
      if (!isDialogOpen() && !isGuest) sel.selectionMode ? sel.exit() : sel.enter();
    },
    { preventDefault: true },
  );
  useHotkeys(
    "Escape",
    () => {
      if (!isDialogOpen() && sel.selectionMode) sel.exit();
    },
    { enableOnFormTags: true },
  );
  useHotkeys(
    "a",
    () => {
      if (!isDialogOpen() && sel.selectionMode) {
        if (sel.selectedIds.size === filteredBookmarkLists.length) {
          sel.deselectAll();
        } else {
          sel.selectAll();
        }
      }
    },
    { preventDefault: true },
  );

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
        {tc("retry")}
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <LoadingBoundary
        isLoading={isLoading}
        skeleton={<BookmarksSkeleton />}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={sel.selectedIds.size === 0 || sel.batchLoading}
                      aria-label={tb("selectionMenu")}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={sel.handleBatchDuplicate}>
                      <Copy className="h-4 w-4" />
                      {tc("duplicate")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => sel.setBatchDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {tc("delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={visibilityFilter}
                onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}
              >
                <SelectTrigger
                  className="h-8 w-[130px] text-xs"
                  aria-label={tb("filterByVisibility")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityFilters.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <span className="flex items-center gap-2">
                        {f.icon}
                        {f.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sel.enter}
                  disabled={!online || filteredBookmarkLists.length === 0}
                >
                  <SquareMousePointer className="h-4 w-4" />
                  {tc("select")}
                  <span className="hidden text-xs text-muted-foreground lg:inline">(S)</span>
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        disabled={!online || bookmarkLists.length >= MAX_BOOKMARK_LISTS_PER_USER}
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        {tb("newList")}
                        <span className="hidden text-xs text-muted-foreground lg:inline">(N)</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {bookmarkLists.length >= MAX_BOOKMARK_LISTS_PER_USER && (
                    <TooltipContent>{tm("limitBookmarkLists")}</TooltipContent>
                  )}
                </Tooltip>
              </div>
            </div>
          )}
        </div>
        {bookmarkLists.length === 0 ? (
          <EmptyState message={tm("emptyBookmarkList")} variant="page" />
        ) : filteredBookmarkLists.length === 0 ? (
          <EmptyState message={tm("emptyBookmarkListFilter")} variant="page" />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBookmarkLists.map((list, index) => (
              <div
                key={list.id}
                className="animate-in fade-in duration-300"
                style={{
                  animationDelay: `${Math.min(index * 50, 300)}ms`,
                  animationFillMode: "both",
                }}
              >
                <BookmarkListCard
                  {...list}
                  selectable={sel.selectionMode}
                  selected={sel.selectedIds.has(list.id)}
                  onSelect={sel.toggle}
                />
              </div>
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
        onClick={() => setCreateDialogOpen(true)}
        label={tb("createListFab")}
        hidden={!online || sel.selectionMode}
      />
    </>
  );
}
