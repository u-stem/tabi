"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CATEGORY_LABELS,
  DEFAULT_SCHEDULE_CATEGORY,
  type ScheduleCategory,
  type ScheduleResponse,
} from "@sugara/shared";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CheckSquare,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectionIndicator } from "@/components/ui/selection-indicator";
import { ApiError, api } from "@/lib/api";
import { SCHEDULE_COLOR_CLASSES, SELECTED_RING } from "@/lib/colors";
import { MSG } from "@/lib/messages";
import { CATEGORY_OPTIONS } from "@/lib/schedule-utils";
import { cn } from "@/lib/utils";

type CandidatePanelProps = {
  tripId: string;
  candidates: ScheduleResponse[];
  currentPatternId: string;
  onRefresh: () => void;
  disabled?: boolean;
  draggable?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onEnterSelectionMode?: () => void;
  onExitSelectionMode?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onBatchAssign?: () => void;
  onBatchDuplicate?: () => void;
  onBatchDelete?: () => void;
  batchLoading?: boolean;
};

function CandidateDragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
}) {
  return (
    <button
      type="button"
      className="shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground"
      aria-label="ドラッグで並び替え"
      {...attributes}
      {...listeners}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="3" r="1.5" />
        <circle cx="11" cy="3" r="1.5" />
        <circle cx="5" cy="8" r="1.5" />
        <circle cx="11" cy="8" r="1.5" />
        <circle cx="5" cy="13" r="1.5" />
        <circle cx="11" cy="13" r="1.5" />
      </svg>
    </button>
  );
}

function CandidateCard({
  spot,
  onEdit,
  onDelete,
  onAssign,
  disabled,
  selectable,
  selected,
  onSelect,
  draggable,
}: {
  spot: ScheduleResponse;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  disabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  draggable?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: spot.id,
    disabled: !draggable || disabled || selectable,
    data: { type: "candidate" },
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 rounded-md border p-2",
          isDragging && "opacity-50",
          selectable && "cursor-pointer transition-colors hover:bg-accent/50",
          selectable && selected && SELECTED_RING,
        )}
        {...(selectable
          ? {
              onClick: () => onSelect?.(spot.id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(spot.id);
                }
              },
              role: "button" as const,
              tabIndex: 0,
              "aria-pressed": selected,
            }
          : {})}
      >
        {selectable ? (
          <SelectionIndicator checked={!!selected} />
        ) : draggable ? (
          <CandidateDragHandle attributes={attributes} listeners={listeners} />
        ) : (
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${SCHEDULE_COLOR_CLASSES[spot.color].bg}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{spot.name}</p>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[spot.category as ScheduleCategory]}
          </p>
        </div>
        {!disabled && !selectable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`${spot.name}のメニュー`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-3 w-3" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onAssign}>
                <ArrowLeft className="mr-2 h-3 w-3" />
                予定に追加
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-3 w-3" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>候補を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{spot.name}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CandidatePanel({
  tripId,
  candidates,
  currentPatternId,
  onRefresh,
  disabled,
  draggable,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onEnterSelectionMode,
  onExitSelectionMode,
  onSelectAll,
  onDeselectAll,
  onBatchAssign,
  onBatchDuplicate,
  onBatchDelete,
  batchLoading,
}: CandidatePanelProps) {
  const { setNodeRef: setDroppableRef } = useDroppable({
    id: "candidates",
    data: { type: "candidates" },
  });
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [category, setCategory] = useState<string>(DEFAULT_SCHEDULE_CATEGORY);
  const [editSchedule, setEditSchedule] = useState<ScheduleResponse | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editCategory, setEditCategory] = useState<string>(DEFAULT_SCHEDULE_CATEGORY);

  async function handleAssign(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/candidates/${spotId}/assign`, {
        method: "POST",
        body: JSON.stringify({ dayPatternId: currentPatternId }),
      });
      toast.success(MSG.CANDIDATE_ASSIGNED);
      onRefresh();
    } catch {
      toast.error(MSG.CANDIDATE_ASSIGN_FAILED);
    }
  }

  async function handleDelete(spotId: string) {
    try {
      await api(`/api/trips/${tripId}/candidates/${spotId}`, {
        method: "DELETE",
      });
      toast.success(MSG.CANDIDATE_DELETED);
      onRefresh();
    } catch {
      toast.error(MSG.CANDIDATE_DELETE_FAILED);
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const memo = (formData.get("memo") as string) || undefined;

    try {
      await api(`/api/trips/${tripId}/candidates`, {
        method: "POST",
        body: JSON.stringify({ name, category, memo }),
      });
      setAddOpen(false);
      toast.success(MSG.CANDIDATE_ADDED);
      onRefresh();
    } catch {
      toast.error(MSG.CANDIDATE_ADD_FAILED);
    } finally {
      setAddLoading(false);
    }
  }

  function openEdit(spot: ScheduleResponse) {
    setEditSchedule(spot);
    setEditCategory(spot.category);
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editSchedule) return;
    setEditLoading(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const memo = (formData.get("memo") as string) || undefined;

    try {
      await api(`/api/trips/${tripId}/candidates/${editSchedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          category: editCategory,
          memo,
          expectedUpdatedAt: editSchedule.updatedAt,
        }),
      });
      setEditSchedule(null);
      toast.success(MSG.CANDIDATE_UPDATED);
      onRefresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(MSG.CONFLICT);
        setEditSchedule(null);
        onRefresh();
      } else {
        toast.error(MSG.CANDIDATE_UPDATE_FAILED);
      }
    } finally {
      setEditLoading(false);
    }
  }

  const selectedCount = selectedIds?.size ?? 0;

  return (
    <div>
      {selectionMode ? (
        <div className="mb-3 flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            <CheckCheck className="h-4 w-4" />
            全選択
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDeselectAll}
            disabled={selectedCount === 0}
          >
            <X className="h-4 w-4" />
            選択解除
          </Button>
          <Button size="sm" onClick={onBatchAssign} disabled={selectedCount === 0 || batchLoading}>
            <ArrowLeft className="h-4 w-4" />
            予定に追加
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={selectedCount === 0 || batchLoading}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onBatchDuplicate}>
                <Copy className="mr-2 h-3 w-3" />
                複製
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onBatchDelete}>
                <Trash2 className="mr-2 h-3 w-3" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={onExitSelectionMode}>
            キャンセル
          </Button>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">候補</h3>
          <div className="flex items-center gap-1.5">
            {!disabled && candidates.length > 0 && onEnterSelectionMode && (
              <Button variant="outline" size="sm" onClick={onEnterSelectionMode}>
                <CheckSquare className="h-4 w-4" />
                選択
              </Button>
            )}
            {!disabled && (
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                候補を追加
              </Button>
            )}
          </div>
        </div>
      )}
      {draggable ? (
        <div ref={setDroppableRef}>
          <SortableContext
            items={candidates.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {candidates.length === 0 ? (
              <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed text-center">
                <p className="text-xs text-muted-foreground">候補がありません</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {candidates.map((spot) => (
                  <CandidateCard
                    key={spot.id}
                    spot={spot}
                    onEdit={() => openEdit(spot)}
                    onDelete={() => handleDelete(spot.id)}
                    onAssign={() => handleAssign(spot.id)}
                    disabled={disabled}
                    draggable={!selectionMode}
                    selectable={selectionMode}
                    selected={selectedIds?.has(spot.id)}
                    onSelect={onToggleSelect}
                  />
                ))}
              </div>
            )}
          </SortableContext>
        </div>
      ) : candidates.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center rounded-md border border-dashed text-center">
          <p className="text-xs text-muted-foreground">候補がありません</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {candidates.map((spot) => (
            <CandidateCard
              key={spot.id}
              spot={spot}
              onEdit={() => openEdit(spot)}
              onDelete={() => handleDelete(spot.id)}
              onAssign={() => handleAssign(spot.id)}
              disabled={disabled}
              selectable={selectionMode}
              selected={selectedIds?.has(spot.id)}
              onSelect={onToggleSelect}
            />
          ))}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setCategory(DEFAULT_SCHEDULE_CATEGORY);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>候補を追加</DialogTitle>
            <DialogDescription>気になる場所を候補に追加しましょう</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="candidate-name">名前</Label>
              <Input id="candidate-name" name="name" placeholder="金閣寺" required />
            </div>
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-memo">メモ</Label>
              <Input id="candidate-memo" name="memo" placeholder="口コミで見た" />
            </div>
            <Button type="submit" className="w-full" disabled={addLoading}>
              <Plus className="h-4 w-4" />
              {addLoading ? "追加中..." : "追加"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editSchedule !== null}
        onOpenChange={(open) => {
          if (!open) setEditSchedule(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>候補を編集</DialogTitle>
            <DialogDescription>候補の情報を変更します</DialogDescription>
          </DialogHeader>
          {editSchedule && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-candidate-name">名前</Label>
                <Input
                  id="edit-candidate-name"
                  name="name"
                  defaultValue={editSchedule.name}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>カテゴリ</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-candidate-memo">メモ</Label>
                <Input
                  id="edit-candidate-memo"
                  name="memo"
                  defaultValue={editSchedule.memo ?? ""}
                  placeholder="口コミで見た"
                />
              </div>
              <Button type="submit" className="w-full" disabled={editLoading}>
                <Check className="h-4 w-4" />
                {editLoading ? "更新中..." : "更新"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
