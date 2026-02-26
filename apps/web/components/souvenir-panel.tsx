"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SouvenirDialog } from "@/components/souvenir-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { isSafeUrl, stripProtocol } from "@/lib/format";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { buildMapsSearchUrl } from "@/lib/transport-link";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type SouvenirItem = {
  id: string;
  name: string;
  recipient: string | null;
  url: string | null;
  address: string | null;
  memo: string | null;
  isPurchased: boolean;
  createdAt: string;
};

type SouvenirPanelProps = {
  tripId: string;
};

export function SouvenirPanel({ tripId }: SouvenirPanelProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
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
      Promise.all(ids.map((id) => api(`/api/trips/${tripId}/souvenirs/${id}`, { method: "DELETE" }))),
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {selectMode ? (
          <>
            <div className="flex items-center gap-2">
              <Checkbox
                id="souvenir-select-all"
                checked={selectedIds.size === items.length && items.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedIds(new Set(items.map((i) => i.id)));
                  } else {
                    setSelectedIds(new Set());
                  }
                }}
                aria-label="全選択"
              />
              <label
                htmlFor="souvenir-select-all"
                className="cursor-pointer text-sm text-muted-foreground"
              >
                {selectedIds.size > 0 ? `${selectedIds.size}件選択中` : "全選択"}
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0 || bulkDeleteMutation.isPending}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </Button>
              <Button variant="outline" size="sm" onClick={exitSelectMode}>
                <X className="h-4 w-4" />
                キャンセル
              </Button>
            </div>
          </>
        ) : (
          <>
            <div />
            <div className="flex gap-2">
              {items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)}>
                  選択
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                お土産を追加
              </Button>
            </div>
          </>
        )}
      </div>

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
              選択した{selectedIds.size}件を削除します。この操作は取り消せません。
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
  selectMode,
  selected,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: SouvenirItem;
  selectMode: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: (isPurchased: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border p-3",
        item.isPurchased && !selectMode ? "opacity-50" : "",
        selectMode && selected ? "border-primary bg-primary/5" : "",
      )}
    >
      {selectMode ? (
        <Checkbox
          checked={selected}
          onCheckedChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0"
          aria-label={`${item.name}を選択`}
        />
      ) : (
        <Checkbox
          checked={item.isPurchased}
          onCheckedChange={(checked) => onToggle(checked === true)}
          className="mt-0.5 shrink-0"
          aria-label={item.isPurchased ? "購入済みを取り消す" : "購入済みにする"}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${item.isPurchased ? "line-through" : ""}`}>
          {item.name}
        </p>
        {item.recipient && <p className="text-xs text-muted-foreground">{item.recipient} 向け</p>}
        {item.address && (
          <a
            href={buildMapsSearchUrl(item.address)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{item.address}</span>
          </a>
        )}
        {item.url && isSafeUrl(item.url) && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit max-w-full items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/70" />
            <span className="truncate">{stripProtocol(item.url)}</span>
          </a>
        )}
        {item.memo && <p className="text-xs text-muted-foreground">{item.memo}</p>}
      </div>
      {!selectMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="メニュー">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              編集
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              削除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
