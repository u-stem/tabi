"use client";

import type { PollOptionResponse, PollResponseValue, SharedPollResponse } from "@sugara/shared";
import { POLL_GUEST_NAME_MAX_LENGTH } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isValid, parse } from "date-fns";
import { ja } from "date-fns/locale";
import { Check, CircleHelp, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

function formatDateLabel(dateStr: string): string {
  const d = parse(dateStr, "yyyy-MM-dd", new Date());
  if (!isValid(d)) return dateStr;
  return format(d, "M/d (E)", { locale: ja });
}

function formatRange(opt: PollOptionResponse): string {
  if (opt.startDate === opt.endDate) return formatDateLabel(opt.startDate);
  return `${formatDateLabel(opt.startDate)} - ${formatDateLabel(opt.endDate)}`;
}

const RESPONSE_ICONS: Record<PollResponseValue, { icon: React.ReactNode; className: string }> = {
  ok: {
    icon: <Check className="h-4 w-4" />,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  maybe: {
    icon: <CircleHelp className="h-4 w-4" />,
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  ng: {
    icon: <X className="h-4 w-4" />,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const RESPONSE_CYCLE: PollResponseValue[] = ["ok", "maybe", "ng"];

export default function SharedPollPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const token = params.token as string;

  const {
    data: poll,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.polls.shared(token),
    queryFn: () => api<SharedPollResponse>(`/api/polls/shared/${token}`),
    retry: false,
  });

  const [guestName, setGuestName] = useState("");
  const [responses, setResponses] = useState<Map<string, PollResponseValue>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleCycleResponse(optionId: string) {
    setResponses((prev) => {
      const next = new Map(prev);
      const current = next.get(optionId);
      const currentIndex = current ? RESPONSE_CYCLE.indexOf(current) : -1;
      next.set(optionId, RESPONSE_CYCLE[(currentIndex + 1) % RESPONSE_CYCLE.length]);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) return;

    setSubmitting(true);
    try {
      await api(`/api/polls/shared/${token}/responses`, {
        method: "POST",
        body: JSON.stringify({
          guestName: guestName.trim(),
          responses: Array.from(responses.entries()).map(([optionId, response]) => ({
            optionId,
            response,
          })),
        }),
      });
      toast.success(MSG.POLL_GUEST_RESPONSE_SUBMITTED);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.shared(token) });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : MSG.POLL_GUEST_RESPONSE_FAILED);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-64 w-full" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <Logo className="mx-auto mb-4 h-8" />
        <p className="text-muted-foreground">{MSG.POLL_SHARED_NOT_FOUND}</p>
      </div>
    );
  }

  const isOpen = poll.status === "open";
  const statusLabel =
    poll.status === "open" ? "日程調整中" : poll.status === "confirmed" ? "確定済み" : "終了";
  const statusClass =
    poll.status === "open"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      : poll.status === "confirmed"
        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Logo className="h-6" />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{poll.title}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{poll.destination}</p>
      </div>

      {poll.note && (
        <div className="rounded-md border p-4">
          <p className="text-sm whitespace-pre-wrap">{poll.note}</p>
        </div>
      )}

      {poll.deadline && (
        <p className="text-xs text-muted-foreground">
          回答期限: {format(new Date(poll.deadline), "yyyy/MM/dd HH:mm", { locale: ja })}
        </p>
      )}

      {/* Confirmed info */}
      {poll.status === "confirmed" && poll.confirmedOptionId && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-sm font-medium">
            確定日程: {formatRange(poll.options.find((o) => o.id === poll.confirmedOptionId)!)}
          </p>
        </div>
      )}

      {/* Response matrix (existing responses) */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">回答状況</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b px-3 py-2 text-left font-medium">参加者</th>
                {poll.options.map((opt) => (
                  <th key={opt.id} className="border-b px-2 py-2 text-center font-medium">
                    <span className="text-xs">{formatRange(opt)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {poll.participants.map((participant) => (
                <tr key={participant.id}>
                  <td className="border-b px-3 py-2 text-sm">{participant.name}</td>
                  {poll.options.map((opt) => {
                    const response = participant.responses.find((r) => r.optionId === opt.id);
                    return (
                      <td key={opt.id} className="border-b px-2 py-2 text-center">
                        {response ? (
                          <span
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${RESPONSE_ICONS[response.response].className}`}
                          >
                            {RESPONSE_ICONS[response.response].icon}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td className="px-3 py-2 text-xs font-medium text-muted-foreground">OK数</td>
                {poll.options.map((opt) => {
                  const okCount = poll.participants.filter((p) =>
                    p.responses.some((r) => r.optionId === opt.id && r.response === "ok"),
                  ).length;
                  return (
                    <td key={opt.id} className="px-2 py-2 text-center text-xs font-medium">
                      {okCount}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Guest response form */}
      {isOpen && !submitted && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-md border p-4">
          <h2 className="text-sm font-semibold">回答する</h2>

          <div className="space-y-2">
            <Label htmlFor="guest-name">
              名前 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="guest-name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="名前を入力"
              maxLength={POLL_GUEST_NAME_MAX_LENGTH}
              required
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">各日程案をタップして回答してください</p>
            <div className="space-y-2">
              {poll.options.map((opt) => {
                const response = responses.get(opt.id);
                return (
                  <div key={opt.id} className="flex items-center gap-3">
                    <span className="min-w-[120px] text-sm">{formatRange(opt)}</span>
                    <button
                      type="button"
                      onClick={() => handleCycleResponse(opt.id)}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border ${
                        response
                          ? RESPONSE_ICONS[response].className
                          : "border-dashed border-muted-foreground/30 text-muted-foreground"
                      }`}
                    >
                      {response ? RESPONSE_ICONS[response].icon : "?"}
                    </button>
                    {response && (
                      <span className="text-xs text-muted-foreground">
                        {response === "ok" ? "OK" : response === "maybe" ? "未定" : "NG"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Button type="submit" disabled={submitting || !guestName.trim()}>
            {submitting ? "送信中..." : "回答を送信"}
          </Button>
        </form>
      )}

      {submitted && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm font-medium">回答を送信しました</p>
        </div>
      )}

      {!isOpen && (
        <p className="text-sm text-muted-foreground text-center">
          この日程調整は{poll.status === "confirmed" ? "確定済み" : "終了"}です
        </p>
      )}
    </div>
  );
}
