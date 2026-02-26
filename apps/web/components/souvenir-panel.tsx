"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MapPin, MoreVertical, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";

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

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.souvenirs.list(tripId) });
    setEditingItem(null);
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
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          お土産を追加
        </Button>
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
    </div>
  );
}

function SouvenirItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: SouvenirItem;
  onToggle: (isPurchased: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border p-3 ${
        item.isPurchased ? "opacity-50" : ""
      }`}
    >
      <Checkbox
        checked={item.isPurchased}
        onCheckedChange={(checked) => onToggle(checked === true)}
        className="mt-0.5 shrink-0"
        aria-label={item.isPurchased ? "購入済みを取り消す" : "購入済みにする"}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${item.isPurchased ? "line-through" : ""}`}>
          {item.name}
        </p>
        {item.recipient && <p className="text-xs text-muted-foreground">{item.recipient} 向け</p>}
        {item.address && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.address}</span>
          </p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            <span className="truncate">{item.url}</span>
          </a>
        )}
        {item.memo && <p className="text-xs text-muted-foreground">{item.memo}</p>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="メニュー">
            <MoreVertical className="h-4 w-4" />
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
    </div>
  );
}
