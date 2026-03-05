"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2, Vote, XCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type PollListItem = {
  id: string;
  question: string;
  shareToken: string;
  status: "open" | "closed";
  allowMultiple: boolean;
  expiresAt: string;
  createdAt: string;
  options: { id: string; label: string; voteCount: number }[];
  totalVotes: number;
};

export default function PollsPage() {
  const queryClient = useQueryClient();

  const { data: polls, isLoading } = useQuery({
    queryKey: queryKeys.quickPolls.list(),
    queryFn: () => api<PollListItem[]>("/api/quick-polls"),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/api/quick-polls/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
      toast.success(MSG.QUICK_POLL_CLOSED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_CLOSE_FAILED),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/quick-polls/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
      toast.success(MSG.QUICK_POLL_DELETED);
    },
    onError: () => toast.error(MSG.QUICK_POLL_DELETE_FAILED),
  });

  async function copyLink(shareToken: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${shareToken}`);
      toast.success(MSG.QUICK_POLL_LINK_COPIED);
    } catch {
      toast.error(MSG.COPY_FAILED);
    }
  }

  return (
    <div className="container max-w-lg py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">投票</h1>
        <Button asChild size="sm">
          <Link href="/polls/new">
            <Plus className="mr-1 h-4 w-4" />
            作成
          </Link>
        </Button>
      </div>

      <LoadingBoundary
        isLoading={isLoading}
        skeleton={
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        {!polls?.length ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Vote className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">{MSG.EMPTY_QUICK_POLL}</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/polls/new">投票を作成</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {polls.map((poll) => (
              <div key={poll.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{poll.question}</p>
                    <p className="text-xs text-muted-foreground">
                      {poll.totalVotes}票 / {poll.status === "open" ? "受付中" : "終了"}
                    </p>
                  </div>
                  <div
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                      poll.status === "open"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {poll.status === "open" ? "受付中" : "終了"}
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyLink(poll.shareToken)}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    リンク
                  </Button>
                  {poll.status === "open" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => closeMutation.mutate(poll.id)}
                      disabled={closeMutation.isPending}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      終了
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(poll.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    削除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </LoadingBoundary>
    </div>
  );
}
