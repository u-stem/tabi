"use client";

import type { PublicProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, Copy, Pencil, Vote } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookmarkListCard } from "@/app/users/[userId]/page";
import { MyQrDialog } from "@/components/my-qr-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { copyToClipboard } from "@/lib/clipboard";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function BookmarkListsSkeleton() {
  return (
    <div className="divide-y overflow-hidden rounded-lg border">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-12 w-full rounded-none" />
      ))}
    </div>
  );
}

export default function MyPage() {
  const { data: session } = useSession();
  const [idCopied, setIdCopied] = useState(false);

  useEffect(() => {
    document.title = pageTitle("プロフィール");
  }, []);

  const user = session?.user;
  const userId = user?.id;

  async function handleCopyId() {
    if (!userId) return;
    await copyToClipboard(userId);
    setIdCopied(true);
    toast.success(MSG.SETTINGS_USER_ID_COPIED);
    setTimeout(() => setIdCopied(false), 2000);
  }
  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile.bookmarkLists(userId ?? ""),
    queryFn: () => api<PublicProfileResponse>(`/api/users/${userId}/bookmark-lists`),
    enabled: !!userId,
    ...QUERY_CONFIG.stable,
  });

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <UserAvatar
          name={user?.name ?? ""}
          image={user?.image}
          className="h-14 w-14 shrink-0"
          fallbackClassName="text-xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{user?.name}</h1>
          {userId && (
            <button
              type="button"
              onClick={handleCopyId}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              aria-label="ユーザーIDをコピー"
            >
              <span className="sr-only" data-testid="user-id">
                {userId}
              </span>
              <span>ID:</span>
              <code className="font-mono">{userId.slice(0, 8)}...</code>
              {idCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/my/edit"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-sm hover:bg-accent"
          >
            <Pencil className="h-3 w-3" />
            編集
          </Link>
          {userId && <MyQrDialog userId={userId} />}
        </div>
      </div>

      {/* Bookmark lists */}
      <div className="space-y-2">
        <SectionHeading>ブックマーク</SectionHeading>
        <LoadingBoundary isLoading={isLoading} skeleton={<BookmarkListsSkeleton />}>
          {profile && profile.bookmarkLists.length > 0 ? (
            <div className="overflow-hidden rounded-lg border divide-y">
              {profile.bookmarkLists.map((list) => (
                <BookmarkListCard key={list.id} list={list} userId={userId ?? ""} />
              ))}
            </div>
          ) : (
            <EmptyState message={MSG.EMPTY_BOOKMARK_LIST} variant="box" />
          )}
        </LoadingBoundary>
      </div>

      {/* Tools */}
      <div className="space-y-2">
        <SectionHeading>ツール</SectionHeading>
        <Link
          href="/polls"
          className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:bg-accent transition-colors"
        >
          <Vote className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 font-medium">かんたん投票</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
