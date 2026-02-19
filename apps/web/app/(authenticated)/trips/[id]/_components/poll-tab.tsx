"use client";

import {
  POLL_NOTE_MAX_LENGTH,
  type PollDetailResponse,
  type PollResponseValue,
} from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Check,
  CheckCheck,
  Circle,
  MessageSquare,
  Plus,
  SquareMousePointer,
  Trash2,
  Triangle,
  X,
} from "lucide-react";
import { useCallback, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { CalendarNav, END_YEAR, START_YEAR } from "@/components/calendar-nav";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, getApiErrorMessage } from "@/lib/api";
import { formatDateRangeShort } from "@/lib/format";
import { usePollMemo } from "@/lib/hooks/use-poll-memo";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const RESPONSE_ICON_COMPONENTS = {
  ok: Circle,
  maybe: Triangle,
  ng: X,
} as const;

const RESPONSE_STYLES: Record<
  PollResponseValue,
  { activeClassName: string; countClassName: string }
> = {
  ok: {
    activeClassName:
      "border-green-400 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400",
    countClassName: "text-green-600 dark:text-green-400",
  },
  maybe: {
    activeClassName:
      "border-yellow-400 bg-yellow-100 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    countClassName: "text-yellow-600 dark:text-yellow-400",
  },
  ng: {
    activeClassName:
      "border-red-400 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400",
    countClassName: "text-red-600 dark:text-red-400",
  },
};

type PollTabProps = {
  pollId: string;
  isOwner: boolean;
  canEdit: boolean;
  onMutate: () => void;
  onConfirmed?: () => void;
};

export function PollTab({ pollId, isOwner, canEdit, onMutate, onConfirmed }: PollTabProps) {
  const queryClient = useQueryClient();

  const { data: poll, isLoading } = useQuery({
    queryKey: queryKeys.polls.detail(pollId),
    queryFn: () => api<PollDetailResponse>(`/api/polls/${pollId}`),
  });

  const memo = usePollMemo({ pollId, onDone: onMutate });

  const [showAddOption, setShowAddOption] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [addOptionMonth, setAddOptionMonth] = useState<Date>(new Date());
  const [showConfirmSelect, setShowConfirmSelect] = useState(false);
  const [confirmOptionId, setConfirmOptionId] = useState<string | null>(null);
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.polls.detail(pollId) }),
    [queryClient, pollId],
  );

  const submitResponsesMutation = useMutation({
    mutationFn: (responses: { optionId: string; response: PollResponseValue }[]) =>
      api(`/api/polls/${pollId}/responses`, {
        method: "PUT",
        body: JSON.stringify({ responses }),
      }),
    onSuccess: () => {
      invalidate();
      onMutate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, MSG.POLL_RESPONSE_SUBMIT_FAILED)),
  });

  const addOptionMutation = useMutation({
    mutationFn: (data: { startDate: string; endDate: string }) =>
      api(`/api/polls/${pollId}/options`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast.success(MSG.POLL_OPTION_ADDED);
      invalidate();
      onMutate();
      setShowAddOption(false);
      setPendingRange(undefined);
    },
    onError: (err) =>
      toast.error(
        getApiErrorMessage(err, MSG.POLL_OPTION_ADD_FAILED, {
          conflict: MSG.POLL_OPTION_DUPLICATE,
        }),
      ),
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId: string) =>
      api(`/api/polls/${pollId}/options/${optionId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(MSG.POLL_OPTION_DELETED);
      invalidate();
      onMutate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, MSG.POLL_OPTION_DELETE_FAILED)),
  });

  const deleteSelectedMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => api(`/api/polls/${pollId}/options/${id}`, { method: "DELETE" }))),
    onSuccess: () => {
      toast.success(MSG.POLL_OPTION_DELETED);
      invalidate();
      onMutate();
      setSelectionMode(false);
      setSelectedOptionIds(new Set());
    },
    onError: (err) => {
      invalidate();
      toast.error(getApiErrorMessage(err, MSG.POLL_OPTION_DELETE_FAILED));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (optionId: string) =>
      api(`/api/polls/${pollId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ optionId }),
      }),
    onSuccess: () => {
      toast.success(MSG.POLL_CONFIRMED);
      invalidate();
      onMutate();
      onConfirmed?.();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, MSG.POLL_CONFIRM_FAILED)),
  });

  function handleSetResponse(optionId: string, value: PollResponseValue) {
    if (!poll?.myParticipantId || poll.status !== "open") return;

    const myParticipant = poll.participants.find((p) => p.id === poll.myParticipantId);
    if (!myParticipant) return;

    const currentResponses = myParticipant.responses;
    const existing = currentResponses.find((r) => r.optionId === optionId);
    const isToggleOff = existing?.response === value;

    const newResponses = poll.options
      .map((opt) => {
        if (opt.id === optionId) {
          return isToggleOff ? null : { optionId: opt.id, response: value };
        }
        const r = currentResponses.find((cr) => cr.optionId === opt.id);
        return r ? { optionId: opt.id, response: r.response } : null;
      })
      .filter((r): r is { optionId: string; response: PollResponseValue } => r !== null);

    submitResponsesMutation.mutate(newResponses);
  }

  function toggleOptionSelect(id: string) {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAddOption() {
    if (!pendingRange?.from) return;
    const startDate = format(pendingRange.from, "yyyy-MM-dd");
    const endDate = pendingRange.to ? format(pendingRange.to, "yyyy-MM-dd") : startDate;
    addOptionMutation.mutate({ startDate, endDate });
  }

  if (isLoading || !poll) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  const isOpen = poll.status === "open";

  return (
    <div className="space-y-4 p-4">
      {/* Note */}
      {(canEdit && isOpen) || poll.note ? (
        <div>
          {memo.editing ? (
            <div className="space-y-2">
              <Textarea
                value={memo.text}
                onChange={(e) => memo.setText(e.target.value)}
                placeholder="メモを入力..."
                maxLength={POLL_NOTE_MAX_LENGTH}
                rows={3}
                className="resize-none text-sm"
                autoFocus
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {memo.text.length}/{POLL_NOTE_MAX_LENGTH}
                </span>
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={memo.cancelEdit}
                    disabled={memo.saving}
                  >
                    キャンセル
                  </Button>
                  <Button size="sm" onClick={memo.save} disabled={memo.saving}>
                    <Check className="h-3.5 w-3.5" />
                    {memo.saving ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (canEdit && isOpen ? memo.startEdit(poll.note) : undefined)}
              className={cn(
                "flex w-full select-none items-start gap-2 rounded-md border border-dashed px-3 py-2 text-left text-sm transition-colors",
                canEdit && isOpen
                  ? "cursor-pointer hover:border-border hover:bg-muted/50"
                  : "cursor-default",
                poll.note
                  ? "border-border text-foreground"
                  : "border-muted-foreground/20 text-muted-foreground",
              )}
            >
              <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-pre-wrap">{poll.note || "メモを追加"}</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Deadline */}
      {poll.deadline && (
        <p className="text-xs text-muted-foreground">
          回答期限: {format(new Date(poll.deadline), "yyyy/MM/dd HH:mm", { locale: ja })}
        </p>
      )}

      {/* Response cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          {isOwner && isOpen && selectionMode ? (
            <div className="flex w-full items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!poll) return;
                  setSelectedOptionIds(new Set(poll.options.map((o) => o.id)));
                }}
                disabled={deleteSelectedMutation.isPending}
              >
                <CheckCheck className="h-4 w-4" />
                全選択
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedOptionIds(new Set())}
                disabled={deleteSelectedMutation.isPending}
              >
                <X className="h-4 w-4" />
                選択解除
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDeleteSelected(true)}
                  disabled={selectedOptionIds.size === 0 || deleteSelectedMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteSelectedMutation.isPending ? "削除中..." : "削除"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedOptionIds(new Set());
                  }}
                  disabled={deleteSelectedMutation.isPending}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold">回答状況</h3>
              {isOwner && isOpen && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                    <SquareMousePointer className="h-4 w-4" />
                    選択
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowAddOption(true)}>
                    <Plus className="h-4 w-4" />
                    日程案追加
                  </Button>
                  <Button size="sm" onClick={() => setShowConfirmSelect(true)}>
                    <Check className="h-4 w-4" />
                    確定
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
        <div
          className="grid divide-y rounded-lg border"
          style={{
            gridTemplateColumns: [
              selectionMode ? "auto" : null,
              "auto",
              poll.myParticipantId && !selectionMode ? "auto" : null,
              "1fr",
              isOwner && isOpen && !selectionMode ? "auto" : null,
            ]
              .filter(Boolean)
              .join(" "),
          }}
        >
          {poll.options.map((opt) => {
            const isConfirmedOption = opt.id === poll.confirmedOptionId;
            const myParticipant = poll.participants.find((p) => p.id === poll.myParticipantId);
            const myResponse = myParticipant?.responses.find((r) => r.optionId === opt.id);

            const counts = (["ok", "maybe", "ng"] as const).map((value) => ({
              value,
              count: poll.participants.filter((p) =>
                p.responses.some((r) => r.optionId === opt.id && r.response === value),
              ).length,
            }));

            return (
              <div
                key={opt.id}
                className={cn(
                  "col-span-full grid grid-cols-subgrid items-center gap-2 px-3 py-2",
                  isConfirmedOption && "bg-blue-50/50 dark:bg-blue-900/10",
                )}
              >
                {selectionMode && (
                  <Checkbox
                    checked={selectedOptionIds.has(opt.id)}
                    onCheckedChange={() => toggleOptionSelect(opt.id)}
                  />
                )}

                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span className="text-sm tabular-nums font-medium">
                    {formatDateRangeShort(opt.startDate, opt.endDate)}
                  </span>
                  {isConfirmedOption && (
                    <Badge
                      variant="outline"
                      className="border-blue-300 px-1 py-0 text-[10px] text-blue-600 dark:border-blue-700 dark:text-blue-400"
                    >
                      確定
                    </Badge>
                  )}
                </div>

                {!selectionMode && poll.myParticipantId && (
                  <div className="flex gap-1">
                    {(["ok", "maybe", "ng"] as const).map((value) => {
                      const config = RESPONSE_STYLES[value];
                      const Icon = RESPONSE_ICON_COMPONENTS[value];
                      const isActive = myResponse?.response === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`flex h-7 w-9 items-center justify-center rounded border transition-colors ${
                            isActive
                              ? config.activeClassName
                              : "border-muted-foreground/20 text-muted-foreground hover:bg-accent"
                          } ${!isOpen ? "opacity-50" : ""}`}
                          onClick={() => handleSetResponse(opt.id, value)}
                          disabled={!isOpen || submitResponsesMutation.isPending}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                  {counts.map(({ value, count }) => {
                    if (count === 0) return null;
                    const Icon = RESPONSE_ICON_COMPONENTS[value];
                    return (
                      <span
                        key={value}
                        className={`inline-flex items-center gap-0.5 ${RESPONSE_STYLES[value].countClassName}`}
                      >
                        <Icon className="h-3 w-3" />
                        {count}
                      </span>
                    );
                  })}
                </div>

                {!selectionMode && isOwner && isOpen && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteOptionId(opt.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add option dialog */}
      <Dialog
        open={showAddOption}
        onOpenChange={(open) => {
          setShowAddOption(open);
          if (!open) setPendingRange(undefined);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>日程案を追加</DialogTitle>
            <DialogDescription>カレンダーで日付範囲を選択してください</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center">
            <CalendarNav
              month={addOptionMonth}
              onMonthChange={setAddOptionMonth}
              showReset={!!pendingRange?.from}
              onReset={() => setPendingRange(undefined)}
            />
            <Calendar
              mode="range"
              selected={pendingRange}
              onSelect={setPendingRange}
              month={addOptionMonth}
              onMonthChange={setAddOptionMonth}
              numberOfMonths={2}
              locale={ja}
              hideNavigation
              startMonth={new Date(START_YEAR, 0)}
              endMonth={new Date(END_YEAR, 11)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddOption(false);
                setPendingRange(undefined);
              }}
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={handleAddOption}
              disabled={!pendingRange?.from || addOptionMutation.isPending}
            >
              <Plus className="h-4 w-4" />
              {addOptionMutation.isPending ? "追加中..." : "追加"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm option select dialog */}
      <Dialog open={showConfirmSelect} onOpenChange={setShowConfirmSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>日程を確定</DialogTitle>
            <DialogDescription>確定する日程案を選択してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {poll.options.map((opt) => {
              const counts = (["ok", "maybe", "ng"] as const).map((value) => ({
                value,
                count: poll.participants.filter((p) =>
                  p.responses.some((r) => r.optionId === opt.id && r.response === value),
                ).length,
              }));
              return (
                <button
                  key={opt.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                  onClick={() => {
                    setShowConfirmSelect(false);
                    setConfirmOptionId(opt.id);
                  }}
                >
                  <span className="font-medium">
                    {formatDateRangeShort(opt.startDate, opt.endDate)}
                  </span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {counts.map(({ value, count }) => {
                      if (count === 0) return null;
                      const Icon = RESPONSE_ICON_COMPONENTS[value];
                      return (
                        <span
                          key={value}
                          className={`inline-flex items-center gap-0.5 ${RESPONSE_STYLES[value].countClassName}`}
                        >
                          <Icon className="h-3 w-3" />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm final dialog */}
      <AlertDialog
        open={!!confirmOptionId}
        onOpenChange={(open) => !open && setConfirmOptionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>日程を確定</AlertDialogTitle>
            <AlertDialogDescription>
              この日程で確定しますか？旅行の日程が更新されます。
              {(() => {
                const opt = poll.options.find((o) => o.id === confirmOptionId);
                return opt ? (
                  <span className="mt-1 block font-medium">
                    {formatDateRangeShort(opt.startDate, opt.endDate)}
                  </span>
                ) : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmOptionId) confirmMutation.mutate(confirmOptionId);
                setConfirmOptionId(null);
              }}
            >
              確定する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete option dialog */}
      <AlertDialog
        open={!!deleteOptionId}
        onOpenChange={(open) => !open && setDeleteOptionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>日程案を削除</AlertDialogTitle>
            <AlertDialogDescription>
              この日程案を削除しますか？回答も全て削除されます。
              {(() => {
                const opt = poll.options.find((o) => o.id === deleteOptionId);
                return opt ? (
                  <span className="mt-1 block font-medium">
                    {formatDateRangeShort(opt.startDate, opt.endDate)}
                  </span>
                ) : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction
              onClick={() => {
                if (deleteOptionId) deleteOptionMutation.mutate(deleteOptionId);
                setDeleteOptionId(null);
              }}
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete selected options dialog */}
      <AlertDialog
        open={confirmDeleteSelected}
        onOpenChange={(open) => !open && setConfirmDeleteSelected(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selectedOptionIds.size}件の日程案を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              選択した日程案と回答が削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction
              onClick={() => {
                deleteSelectedMutation.mutate([...selectedOptionIds]);
                setConfirmDeleteSelected(false);
              }}
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
