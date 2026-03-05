"use client";

import type { QuickPollResponse } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Vote } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

const ANONYMOUS_ID_KEY = "sugara_quick_poll_anon_id";

function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(ANONYMOUS_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_ID_KEY, id);
  }
  return id;
}

export default function QuickPollPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : null;
  const queryClient = useQueryClient();

  const anonymousId = useMemo(() => getAnonymousId(), []);

  const {
    data: poll,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.quickPolls.shared(token ?? ""),
    queryFn: () => api<QuickPollResponse>(`/api/quick-polls/s/${token}?anonymousId=${anonymousId}`),
    enabled: token !== null,
    retry: false,
  });

  const voteMutation = useMutation({
    mutationFn: (optionIds: string[]) =>
      api(`/api/quick-polls/s/${token}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionIds, anonymousId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(token ?? "") });

      toast.success(MSG.QUICK_POLL_VOTED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_VOTE_FAILED),
  });

  const cancelVoteMutation = useMutation({
    mutationFn: () =>
      api(`/api/quick-polls/s/${token}/vote`, {
        method: "DELETE",
        body: JSON.stringify({ anonymousId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(token ?? "") });

      toast.success(MSG.QUICK_POLL_VOTE_CANCELLED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_VOTE_CANCEL_FAILED),
  });

  const isOpen = poll?.status === "open";
  const hasVoted = (poll?.myVoteOptionIds.length ?? 0) > 0;
  const canSeeResults = poll?.showResultsBeforeVote || hasVoted || !isOpen;

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center">
          <Logo />
          <span className="ml-2 text-sm text-muted-foreground">投票</span>
        </div>
      </header>
      <LoadingBoundary isLoading={isLoading} skeleton={<PollSkeleton />} delay={0}>
        {error || !poll ? (
          <div className="container flex max-w-lg flex-col items-center py-16 text-center">
            <Vote className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-destructive">{MSG.QUICK_POLL_NOT_FOUND}</p>
          </div>
        ) : (
          <div className="container max-w-lg py-8 space-y-6">
            <h1 className="break-words text-xl font-bold">{poll.question}</h1>

            <div className="space-y-2">
              {poll.options.map((opt) => {
                const isSelected = poll.myVoteOptionIds.includes(opt.id);
                const percentage =
                  poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={!isOpen || voteMutation.isPending}
                    onClick={() => {
                      if (!isOpen) return;
                      if (poll.allowMultiple) {
                        const current = new Set(poll.myVoteOptionIds);
                        if (current.has(opt.id)) {
                          current.delete(opt.id);
                          if (current.size === 0) {
                            cancelVoteMutation.mutate();
                          } else {
                            voteMutation.mutate([...current]);
                          }
                        } else {
                          current.add(opt.id);
                          voteMutation.mutate([...current]);
                        }
                      } else {
                        if (isSelected) {
                          cancelVoteMutation.mutate();
                        } else {
                          voteMutation.mutate([opt.id]);
                        }
                      }
                    }}
                    className={`relative w-full overflow-hidden rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    } ${!isOpen ? "cursor-default opacity-75" : ""}`}
                  >
                    {canSeeResults && (
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    )}
                    <div className="relative flex items-center justify-between">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <div className="flex items-center gap-2">
                        {canSeeResults && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {opt.voteCount}票 ({percentage}%)
                          </span>
                        )}
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {canSeeResults && (
              <p className="text-center text-xs text-muted-foreground">合計 {poll.totalVotes} 票</p>
            )}

            {!isOpen && (
              <p className="text-center text-sm text-muted-foreground">この投票は終了しています</p>
            )}
          </div>
        )}
      </LoadingBoundary>
    </div>
  );
}

function PollSkeleton() {
  return (
    <div className="container max-w-lg py-8 space-y-6">
      <Skeleton className="h-7 w-3/4" />
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
      <Skeleton className="mx-auto h-4 w-16" />
    </div>
  );
}
