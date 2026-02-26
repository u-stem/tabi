"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  User,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { ItemMenuButton } from "@/components/item-menu-button";
import { useMobile } from "@/lib/hooks/use-is-mobile";

const SouvenirDialog = dynamic(() =>
  import("@/components/souvenir-dialog").then((mod) => mod.SouvenirDialog),
);

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { SELECTED_RING } from "@/lib/colors";
import { isSafeUrl, stripProtocol } from "@/lib/format";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";
import { buildMapsSearchUrl } from "@/lib/transport-link";
import { cn } from "@/lib/utils";

type SouvenirItem = {
  id: string;
  name: string;
  recipient: string | null;
  urls: string[];
  addresses: string[];
  memo: string | null;
  isPurchased: boolean;
  createdAt: string;
};

type SouvenirPanelProps = {
  tripId: string;
  addOpen?: boolean;
  onAddOpenChange?: (open: boolean) => void;
};

export function SouvenirPanel({ tripId, addOpen, onAddOpenChange }: SouvenirPanelProps) {
  const isMobile = useMobile();
  const queryClient = useQueryClient();
  const [internalDialogOpen, setInternalDialogOpen] = useState(false);
  const dialogOpen = addOpen ?? internalDialogOpen;
  const setDialogOpen = onAddOpenChange ?? setInternalDialogOpen;
  const [editingItem, setEditingItem] = useState<SouvenirItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SouvenirItem | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.souvenirs.list(tripId),
    queryFn: () => api<{ items: SouvenirItem[] }>(`/api/trips/${tripId}/souvenirs`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPurchased }: { id: string; isPurchased: boolean }) =>
      api(`/api/trips/${tripId}/souvenirs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isPurchased }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to update"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/trips/${tripId}/souvenirs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to delete"));
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(
        ids.map((id) => api(`/api/trips/${tripId}/souvenirs/${id}`, { method: "DELETE" })),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkDeleteOpen(false);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to delete"));
    },
  });

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
    setEditingItem(null);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const showSkeleton = useDelayedLoading(isLoading);

  if (showSkeleton) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-md" />
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    );
  }

  if (isLoading) return null;

  if (isError) {
    return <p className="py-8 text-center text-sm text-muted-foreground">読み込みに失敗しました</p>;
  }

  const items = data?.items ?? [];
  const purchased = items.filter((i) => i.isPurchased);
  const remaining = items.filter((i) => !i.isPurchased);
  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-3">
      {selectMode ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-muted px-1.5 py-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={exitSelectMode}>
            <X className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium">{selectedCount}件選択中</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() =>
              selectedCount === items.length
                ? setSelectedIds(new Set())
                : setSelectedIds(new Set(items.map((i) => i.id)))
            }
          >
            {selectedCount === items.length ? "全解除" : "全選択"}
          </Button>
          <div className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              disabled={selectedCount === 0 || bulkDeleteMutation.isPending}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              削除
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-1.5">
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setSelectMode(true)}>
              <CheckSquare className="h-4 w-4" />
              選択
            </Button>
          )}
          {!isMobile && (
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              お土産を追加
            </Button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          お土産リストはまだありません
        </p>
      ) : (
        <div className="space-y-1">
          {remaining.map((item) => (
            <SouvenirItemRow
              key={item.id}
              item={item}
              isMobile={isMobile}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onSelect={() => toggleSelect(item.id)}
              onToggle={(isPurchased) => toggleMutation.mutate({ id: item.id, isPurchased })}
              onEdit={() => {
                setEditingItem(item);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
          {purchased.length > 0 && remaining.length > 0 && <div className="my-2 border-t" />}
          {purchased.map((item) => (
            <SouvenirItemRow
              key={item.id}
              item={item}
              isMobile={isMobile}
              selectMode={selectMode}
              selected={selectedIds.has(item.id)}
              onSelect={() => toggleSelect(item.id)}
              onToggle={(isPurchased) => toggleMutation.mutate({ id: item.id, isPurchased })}
              onEdit={() => {
                setEditingItem(item);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteTarget(item)}
            />
          ))}
        </div>
      )}

      <SouvenirDialog
        tripId={tripId}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        item={editingItem}
        onSaved={handleSaved}
      />

      <ResponsiveAlertDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              「{deleteTarget?.name}」を削除します。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              キャンセル
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>

      <ResponsiveAlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(v) => !v && setBulkDeleteOpen(false)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>まとめて削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              選択した{selectedCount}件を削除します。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              キャンセル
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => bulkDeleteMutation.mutate([...selectedIds])}
              disabled={bulkDeleteMutation.isPending}
            >
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </div>
  );
}

function SouvenirItemRow({
  item,
  isMobile,
  selectMode,
  selected,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: SouvenirItem;
  isMobile: boolean;
  selectMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: (isPurchased: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border p-3",
        item.isPurchased && !selectMode ? "opacity-50" : "",
        selectMode &&
          "cursor-pointer transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selectMode && selected && SELECTED_RING,
      )}
      {...(selectMode
        ? {
            onClick: onSelect,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            },
            role: "button" as const,
            tabIndex: 0,
            "aria-pressed": selected,
          }
        : {})}
    >
      {selectMode ? (
        <SelectionIndicator checked={selected} />
      ) : (
        <Checkbox
          checked={item.isPurchased}
          onCheckedChange={(checked) => onToggle(checked === true)}
          className="shrink-0"
          aria-label={item.isPurchased ? "購入済みを取り消す" : "購入済みにする"}
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${item.isPurchased && !selectMode ? "line-through" : ""}`}
        >
          {item.name}
        </p>
        {(item.recipient || item.addresses.length > 0 || item.urls.length > 0 || item.memo) && (
          <div className={cn("mt-1 space-y-1", selectMode && "pointer-events-none")}>
            {item.recipient && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span>{item.recipient} 向け</span>
              </div>
            )}
            {item.addresses.map((addr) => (
              <a
                key={addr}
                href={buildMapsSearchUrl(addr)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{addr}</span>
              </a>
            ))}
            {item.urls.filter(isSafeUrl).map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                <span className="truncate">{stripProtocol(url)}</span>
              </a>
            ))}
            {item.memo && (
              <div className="flex items-start gap-1.5 text-xs text-muted-foreground/70">
                <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
                <p className="whitespace-pre-line">{item.memo}</p>
              </div>
            )}
          </div>
        )}
      </div>
      {!selectMode &&
        (isMobile ? (
          <>
            <ItemMenuButton
              ariaLabel={`${item.name}のメニュー`}
              onClick={() => setSheetOpen(true)}
            />
            <ActionSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              actions={[
                {
                  label: "編集",
                  icon: <Pencil className="h-4 w-4" />,
                  onClick: onEdit,
                },
                {
                  label: "削除",
                  icon: <Trash2 className="h-4 w-4" />,
                  onClick: onDelete,
                  variant: "destructive" as const,
                },
              ]}
            />
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ItemMenuButton ariaLabel={`${item.name}のメニュー`} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
    </div>
  );
}
