"use client";

import type { PollResponseValue, SharedPollResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Calendar, Circle, MapPin, MessageSquare, Triangle, X } from "lucide-react";
import { useParams } from "next/navigation";
import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDateFromISO, formatDateRangeShort } from "@/lib/format";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

const RESPONSE_ICON_COMPONENTS = {
  ok: Circle,
  maybe: Triangle,
  ng: X,
} as const;

const RESPONSE_STYLES: Record<PollResponseValue, { countClassName: string }> = {
  ok: { countClassName: "text-green-600 dark:text-green-400" },
  maybe: { countClassName: "text-yellow-600 dark:text-yellow-400" },
  ng: { countClassName: "text-red-600 dark:text-red-400" },
};

function SharedPollHeader() {
  return (
    <header className="border-b">
      <div className="container flex h-14 items-center">
        <Logo />
        <span className="ml-2 text-sm text-muted-foreground">日程調整</span>
      </div>
    </header>
  );
}

export default function SharedPollPage() {
  const params = useParams();
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

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SharedPollHeader />
        <div className="container max-w-3xl py-8">
          <div className="mb-6">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="mt-2 h-4 w-24" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="min-h-screen">
        <SharedPollHeader />
        <div className="container flex max-w-3xl flex-col items-center py-16 text-center">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-destructive">{MSG.POLL_SHARED_NOT_FOUND}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            リンクが正しいか確認するか、共有元に問い合わせてください
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SharedPollHeader />
      <div className="container max-w-3xl py-8 space-y-6">
        <div>
          <h1 className="break-words text-xl font-bold sm:text-2xl">{poll.title}</h1>
          {poll.destination && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {poll.destination}
              </span>
            </div>
          )}
        </div>

        {poll.note && (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="whitespace-pre-wrap">{poll.note}</span>
          </div>
        )}

        {poll.deadline && (
          <p className="text-xs text-muted-foreground">
            回答期限: {format(new Date(poll.deadline), "yyyy/MM/dd HH:mm", { locale: ja })}
          </p>
        )}

        {poll.shareExpiresAt && (
          <p className="text-xs text-muted-foreground">
            共有リンクの有効期限: {formatDateFromISO(poll.shareExpiresAt)}
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">回答状況</h3>
          <OptionList poll={poll} />
        </div>

        {poll.status !== "open" && (
          <p className="text-sm text-muted-foreground text-center">
            この日程調整は{poll.status === "confirmed" ? "確定済み" : "終了"}です
          </p>
        )}
      </div>
    </div>
  );
}

function OptionList({ poll }: { poll: SharedPollResponse }) {
  return (
    <div className="divide-y rounded-lg border">
      {poll.options.map((opt) => {
        const counts = (["ok", "maybe", "ng"] as const).map((value) => ({
          value,
          count: poll.participants.filter((p) =>
            p.responses.some((r) => r.optionId === opt.id && r.response === value),
          ).length,
        }));

        return (
          <div key={opt.id} className="flex items-center gap-2 px-3 py-2">
            <span className="min-w-[11rem] whitespace-nowrap text-sm tabular-nums font-medium">
              {formatDateRangeShort(opt.startDate, opt.endDate)}
            </span>

            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
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
          </div>
        );
      })}
    </div>
  );
}
