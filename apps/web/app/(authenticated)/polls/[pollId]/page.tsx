"use client";

import type { PollDetailResponse, PollOptionResponse, PollResponseValue } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parse } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Check,
  Link2,
  Link as LinkIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { CalendarNav, END_YEAR, START_YEAR } from "@/components/calendar-nav";
import {
  AlertDialog,
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
import { Skeleton } from "@/components/ui/skeleton";
import { api, getApiErrorMessage } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { pageTitle } from "@/lib/constants";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

const EditPollDialog = dynamic(() =>
  import("@/components/edit-poll-dialog").then((mod) => mod.EditPollDialog),
);

const PollParticipantDialog = dynamic(() =>
  import("@/components/poll-participant-dialog").then((mod) => mod.PollParticipantDialog),
);

const ShareDialog = dynamic(() =>
  import("@/components/share-dialog").then((mod) => mod.ShareDialog),
);

function formatDateLabel(dateStr: string): string {
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  if (!isValid(d)) return dateStr;
  return format(d, "M/d (E)", { locale: ja });
}

function formatRange(opt: PollOptionResponse): string {
  if (opt.startDate === opt.endDate) return formatDateLabel(opt.startDate);
  return `${formatDateLabel(opt.startDate)} - ${formatDateLabel(opt.endDate)}`;
}

const STATUS_CONFIG = {
  open: {
    label: "日程調整中",
    className:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800",
  },
  confirmed: {
    label: "確定済み",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  closed: {
    label: "終了",
    className:
      "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800",
  },
} as const;

const RESPONSE_CONFIG: Record<
  PollResponseValue,
  { symbol: string; activeClassName: string; countClassName: string }
> = {
  ok: {
    symbol: "○",
    activeClassName:
      "border-green-400 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400",
    countClassName: "text-green-600 dark:text-green-400",
  },
  maybe: {
    symbol: "△",
    activeClassName:
      "border-yellow-400 bg-yellow-100 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    countClassName: "text-yellow-600 dark:text-yellow-400",
  },
  ng: {
    symbol: "×",
    activeClassName:
      "border-red-400 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400",
    countClassName: "text-red-600 dark:text-red-400",
  },
};

export default function PollDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pollId = params.pollId as string;

  const {
    data: poll,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.polls.detail(pollId),
    queryFn: () => api<PollDetailResponse>(`/api/polls/${pollId}`),
  });
  useAuthRedirect(error);

  const showSkeleton = useDelayedLoading(isLoading);

  useEffect(() => {
    if (poll) {
      document.title = pageTitle(poll.title);
    }
  }, [poll?.title]);

  const [showAddOption, setShowAddOption] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>();
  const [addOptionMonth, setAddOptionMonth] = useState<Date>(new Date());
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConfirmSelect, setShowConfirmSelect] = useState(false);
  const [confirmOptionId, setConfirmOptionId] = useState<string | null>(null);
  const [deleteOptionId, setDeleteOptionId] = useState<string | null>(null);
  const [participantDialogOpen, setParticipantDialogOpen] = useState(false);

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.polls.detail(pollId) }),
    [queryClient, pollId],
  );

  // --- Mutations ---

  const submitResponsesMutation = useMutation({
    mutationFn: (responses: { optionId: string; response: PollResponseValue }[]) =>
      api(`/api/polls/${pollId}/responses`, {
        method: "PUT",
        body: JSON.stringify({ responses }),
      }),
    onSuccess: () => invalidate(),
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
      setShowAddOption(false);
      setPendingRange(undefined);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, MSG.POLL_OPTION_ADD_FAILED)),
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (optionId: string) =>
      api(`/api/polls/${pollId}/options/${optionId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(MSG.POLL_OPTION_DELETED);
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, MSG.POLL_OPTION_DELETE_FAILED)),
  });

  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      const data = await api<{ shareToken: string }>(`/api/polls/${pollId}/share`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const url = `${window.location.origin}/polls/shared/${data.shareToken}`;
      setShareUrl(url);
      setShareDialogOpen(true);
      try {
        await copyToClipboard(url);
        toast.success(MSG.POLL_SHARE_LINK_COPIED);
      } catch {
        // Clipboard may not be available
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.POLL_SHARE_LINK_FAILED));
    } finally {
      setSharing(false);
    }
  }

  const confirmMutation = useMutation({
    mutationFn: (optionId: string) =>
      api(`/api/polls/${pollId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ optionId }),
      }),
    onSuccess: () => {
      toast.success(MSG.POLL_CONFIRMED);
      invalidate();
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, MSG.POLL_CONFIRM_FAILED)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/api/polls/${pollId}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(MSG.POLL_DELETED);
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
      router.push("/home");
    },
    onError: (err) => toast.error(getApiErrorMessage(err, MSG.POLL_DELETE_FAILED)),
  });

  // --- Response handling ---

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

  function handleAddOption() {
    if (!pendingRange?.from) return;
    const startDate = format(pendingRange.from, "yyyy-MM-dd");
    const endDate = pendingRange.to ? format(pendingRange.to, "yyyy-MM-dd") : startDate;
    addOptionMutation.mutate({ startDate, endDate });
  }

  // --- Loading / Error states ---

  if (isLoading && !showSkeleton) return <div />;

  if (showSkeleton) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-32" />
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="ml-auto h-8 w-8 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <p className="text-muted-foreground">{MSG.POLL_NOT_FOUND}</p>
        <Button variant="link" asChild className="mt-4">
          <Link href="/home">ホームに戻る</Link>
        </Button>
      </div>
    );
  }

  const isOpen = poll.status === "open";
  const status = STATUS_CONFIG[poll.status];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="min-w-0 truncate text-2xl font-bold">{poll.title}</h1>
          <Badge variant="outline" className={status.className}>
            {status.label}
          </Badge>
        </div>
        <p className="text-muted-foreground">{poll.destination}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {poll.isOwner && isOpen && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => setParticipantDialogOpen(true)}
            >
              <Users className="h-4 w-4" />
              参加者
            </Button>
          )}
          {poll.isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => handleShare()}
              disabled={sharing}
            >
              <LinkIcon className="h-4 w-4" />
              {sharing ? "生成中..." : "共有リンク"}
            </Button>
          )}
          {poll.isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">日程調整メニュー</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isOpen && (
                  <DropdownMenuItem
                    className="sm:hidden"
                    onClick={() => setParticipantDialogOpen(true)}
                  >
                    <Users />
                    参加者
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="sm:hidden"
                  onClick={() => handleShare()}
                  disabled={sharing}
                >
                  <LinkIcon />
                  共有リンク
                </DropdownMenuItem>
                {isOpen && (
                  <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
                    <Pencil />
                    編集
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Note & deadline */}
      {(poll.note || poll.deadline) && (
        <div className="space-y-1 rounded-md border p-4">
          {poll.note && <p className="text-sm whitespace-pre-wrap">{poll.note}</p>}
          {poll.deadline && (
            <p className="text-xs text-muted-foreground">
              回答期限: {format(new Date(poll.deadline), "yyyy/MM/dd HH:mm", { locale: ja })}
            </p>
          )}
        </div>
      )}

      {/* Confirmed trip link */}
      {poll.status === "confirmed" && poll.tripId && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">旅行が作成されました</p>
              <p className="text-xs text-muted-foreground">
                確定日程: {formatRange(poll.options.find((o) => o.id === poll.confirmedOptionId)!)}
              </p>
            </div>
            <Button size="sm" asChild>
              <Link href={`/trips/${poll.tripId}`}>
                <Link2 className="h-4 w-4" />
                旅行を見る
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Response cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">回答状況</h2>
          {poll.isOwner && isOpen && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddOption(true)}>
                <Plus className="h-4 w-4" />
                候補日を追加
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowConfirmSelect(true)}>
                <Check className="h-4 w-4" />
                日程を確定
              </Button>
            </div>
          )}
        </div>
        <div className="divide-y rounded-lg border">
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
                className={`flex items-center gap-3 px-3 py-2 ${
                  isConfirmedOption ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                }`}
              >
                {/* Date */}
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-sm font-medium">{formatRange(opt)}</span>
                  {isConfirmedOption && (
                    <Badge
                      variant="outline"
                      className="border-blue-300 px-1 py-0 text-[10px] text-blue-600 dark:border-blue-700 dark:text-blue-400"
                    >
                      確定
                    </Badge>
                  )}
                </div>

                {/* ○ △ × buttons */}
                {poll.myParticipantId && (
                  <div className="flex gap-1">
                    {(["ok", "maybe", "ng"] as const).map((value) => {
                      const config = RESPONSE_CONFIG[value];
                      const isActive = myResponse?.response === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          className={`flex h-7 w-8 items-center justify-center rounded border text-sm font-medium transition-colors ${
                            isActive
                              ? config.activeClassName
                              : "border-muted-foreground/20 text-muted-foreground hover:bg-accent"
                          } ${!isOpen ? "opacity-50" : ""}`}
                          onClick={() => handleSetResponse(opt.id, value)}
                          disabled={!isOpen || submitResponsesMutation.isPending}
                        >
                          {config.symbol}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Counts */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                  {counts.map(
                    ({ value, count }) =>
                      count > 0 && (
                        <span key={value} className={RESPONSE_CONFIG[value].countClassName}>
                          {RESPONSE_CONFIG[value].symbol}
                          {count}
                        </span>
                      ),
                  )}
                </div>

                {/* Menu */}
                {poll.isOwner && isOpen && (
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

      {/* Edit poll dialog */}
      <EditPollDialog
        pollId={pollId}
        title={poll.title}
        destination={poll.destination}
        note={poll.note}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onUpdate={invalidate}
      />

      {/* Share dialog */}
      {shareUrl && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          shareUrl={shareUrl}
          expiresAt={null}
        />
      )}

      {/* Participant dialog */}
      <PollParticipantDialog
        pollId={pollId}
        participants={poll.participants.map((p) => ({
          id: p.id,
          userId: p.userId,
          name: p.name,
        }))}
        isOwner={poll.isOwner}
        open={participantDialogOpen}
        onOpenChange={setParticipantDialogOpen}
        onMutate={invalidate}
      />

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
            <DialogTitle>候補日を追加</DialogTitle>
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

      {/* Delete confirm dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>日程調整を削除</AlertDialogTitle>
            <AlertDialogDescription>
              この日程調整を削除しますか？この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction onClick={() => deleteMutation.mutate()}>
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm option select dialog */}
      <Dialog open={showConfirmSelect} onOpenChange={setShowConfirmSelect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>日程を確定</DialogTitle>
            <DialogDescription>確定する候補日を選択してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {poll.options.map((opt) => {
              const okCount = poll.participants.filter((p) =>
                p.responses.some((r) => r.optionId === opt.id && r.response === "ok"),
              ).length;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                  onClick={() => {
                    setShowConfirmSelect(false);
                    setConfirmOptionId(opt.id);
                  }}
                >
                  <span className="font-medium">{formatRange(opt)}</span>
                  <span className="text-sm text-muted-foreground">
                    ○ {okCount}/{poll.participants.length}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm option final dialog */}
      <AlertDialog
        open={!!confirmOptionId}
        onOpenChange={(open) => !open && setConfirmOptionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>日程を確定</AlertDialogTitle>
            <AlertDialogDescription>
              この日程で確定し、旅行を作成しますか？
              {confirmOptionId && (
                <span className="mt-1 block font-medium">
                  {formatRange(poll.options.find((o) => o.id === confirmOptionId)!)}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                if (confirmOptionId) confirmMutation.mutate(confirmOptionId);
                setConfirmOptionId(null);
              }}
            >
              確定する
            </AlertDialogDestructiveAction>
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
            <AlertDialogTitle>候補日を削除</AlertDialogTitle>
            <AlertDialogDescription>
              この候補日を削除しますか？回答も全て削除されます。
              {deleteOptionId && (
                <span className="mt-1 block font-medium">
                  {formatRange(poll.options.find((o) => o.id === deleteOptionId)!)}
                </span>
              )}
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
    </div>
  );
}
