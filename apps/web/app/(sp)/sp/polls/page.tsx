"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreateQuickPollDialog } from "@/components/create-quick-poll-dialog";
import { Fab } from "@/components/fab";
import { ShareDialog } from "@/components/share-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
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

function SpPollsSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      {["skeleton-1", "skeleton-2"].map((key) => (
        <div key={key} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SpPollsPage() {
  const tm = useTranslations("messages");
  const tp = useTranslations("poll");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [shareDialogToken, setShareDialogToken] = useState<string | null>(null);

  useEffect(() => {
    document.title = pageTitle(tp("pageTitle"));
  }, []);

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
      toast.success(tm("quickPollClosed"));
    },
    onError: () => toast.error(tm("quickPollCloseFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/quick-polls/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
      toast.success(tm("quickPollDeleted"));
    },
    onError: () => toast.error(tm("quickPollDeleteFailed")),
  });

  function invalidateList() {
    queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.list() });
  }

  const shareUrl = shareDialogToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${shareDialogToken}`
    : "";

  return (
    <>
      <LoadingBoundary isLoading={isLoading} skeleton={<SpPollsSkeleton />}>
        {!polls?.length ? (
          <EmptyState message={tm("emptyQuickPoll")} variant="page" />
        ) : (
          <div className="mt-4 space-y-3">
            {polls.map((poll) => (
              <Link
                key={poll.id}
                href={`/sp/polls/${poll.id}`}
                className="block rounded-lg border p-4 space-y-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{poll.question}</p>
                    <p className="text-xs text-muted-foreground">
                      {tp("votesCount", { count: poll.totalVotes })}
                    </p>
                  </div>
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

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setShareDialogToken(poll.shareToken);
                    }}
                  >
                    <Share2 className="mr-1 h-3.5 w-3.5" />
                    {tp("share")}
                  </Button>
                  {poll.status === "open" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        closeMutation.mutate(poll.id);
                      }}
                      disabled={closeMutation.isPending}
                    >
                      <XCircle className="mr-1 h-3.5 w-3.5" />
                      {tp("close")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      deleteMutation.mutate(poll.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {tc("delete")}
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </LoadingBoundary>
      <CreateQuickPollDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={invalidateList}
      />
      <ShareDialog
        open={shareDialogToken !== null}
        onOpenChange={(open) => {
          if (!open) setShareDialogToken(null);
        }}
        shareUrl={shareUrl}
        expiresAt={null}
      />
      <Fab onClick={() => setCreateDialogOpen(true)} label={tp("createPollFab")} />
    </>
  );
}
