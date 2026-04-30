"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { useEffect } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api, apiVoid } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";

type PollDetail = {
  id: string;
  question: string;
  shareToken: string;
  status: "open" | "closed";
  allowMultiple: boolean;
  showResultsBeforeVote: boolean;
  expiresAt: string;
  createdAt: string;
  options: { id: string; label: string; voteCount: number }[];
  totalVotes: number;
};

function DetailSkeleton() {
  return (
    <div className="space-y-6">
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

export default function QuickPollDetailPage() {
  const tm = useTranslations("messages");
  const tp = useTranslations("poll");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pollId = typeof params.id === "string" ? params.id : "";
  const {
    data: poll,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.quickPolls.detail(pollId),
    queryFn: () => api<PollDetail>(`/api/quick-polls/${pollId}`),
    enabled: pollId !== "",
  });

  useEffect(() => {
    if (poll) document.title = pageTitle(poll.question);
  }, [poll]);

  const closeMutation = useMutation({
    mutationFn: () =>
      api(`/api/quick-polls/${pollId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.detail(pollId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
      toast.success(tm("quickPollClosed"));
    },
    onError: () => toast.error(tm("quickPollCloseFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiVoid(`/api/quick-polls/${pollId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
      toast.success(tm("quickPollDeleted"));
      router.push("/polls");
    },
    onError: () => toast.error(tm("quickPollDeleteFailed")),
  });

  const shareUrl =
    poll && typeof window !== "undefined" ? `${window.location.origin}/p/${poll.shareToken}` : "";

  return (
    <div className="mt-4 mx-auto max-w-lg">
      <Link
        href="/polls"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {tp("backToList")}
      </Link>

      <LoadingBoundary isLoading={isLoading} skeleton={<DetailSkeleton />}>
        {error ? (
          <p className="text-center text-destructive">{tm("quickPollNotFound")}</p>
        ) : poll ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <h1 className="break-words text-xl font-bold">{poll.question}</h1>
              <div
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  poll.status === "open"
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {poll.status === "open" ? tp("statusOpen") : tp("statusClosed")}
              </div>
            </div>

            {/* Results */}
            <div className="space-y-2">
              {poll.options.map((opt) => {
                const percentage =
                  poll.totalVotes > 0 ? Math.round((opt.voteCount / poll.totalVotes) * 100) : 0;
                return (
                  <div key={opt.id} className="relative overflow-hidden rounded-lg border p-3">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {tp("votesCount", { count: opt.voteCount })} ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {tp("totalVotes", { count: poll.totalVotes })}
            </p>

            {/* Share */}
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-medium">{tp("shareLink")}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-sm"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <CopyButton
                  value={shareUrl}
                  successMessage={tm("quickPollLinkCopied")}
                  label={tp("copyUrl")}
                />
              </div>
              <div className="flex justify-center rounded-md border bg-white p-4 dark:border-0 dark:shadow-sm">
                <QRCodeSVG value={shareUrl} size={200} level="M" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {poll.status === "open" && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  {tp("closePoll")}
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1 h-4 w-4" />
                {tc("delete")}
              </Button>
            </div>
          </div>
        ) : null}
      </LoadingBoundary>
    </div>
  );
}
