"use client";

import type { PublicProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookmarkListCard } from "@/app/users/[userId]/page";
import { MyQrDialog } from "@/components/my-qr-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { copyToClipboard } from "@/lib/clipboard";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export default function SpMyPage() {
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
    <div className="mt-4 mx-auto max-w-2xl space-y-4">
      {/* Profile header */}
      <div className="flex flex-col items-center gap-3 py-4">
        <UserAvatar
          name={user?.name ?? ""}
          image={user?.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <div className="text-center">
          <h1 className="text-lg font-semibold">{user?.name}</h1>
          {userId && (
            <button
              type="button"
              onClick={handleCopyId}
              className="mt-1 mx-auto flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="ユーザーIDをコピー"
            >
              <span className="sr-only" data-testid="user-id">
                {userId}
              </span>
              <span>ユーザーID:</span>
              <code className="font-mono">{userId.slice(0, 8)}...</code>
              {idCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sp/my/edit"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-sm hover:bg-accent"
          >
            <Pencil className="h-3 w-3" />
            プロフィールを編集
          </Link>
          {userId && <MyQrDialog userId={userId} />}
        </div>
      </div>

      {/* Bookmark lists — no delayed skeleton: header is always visible so we show skeleton
          immediately to avoid layout shift when the section mounts below the header */}
      {isLoading && (
        <div className="overflow-hidden rounded-lg border divide-y">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none" />
          ))}
        </div>
      )}
      {!isLoading && profile && profile.bookmarkLists.length > 0 && (
        <div className="overflow-hidden rounded-lg border divide-y">
          {profile.bookmarkLists.map((list) => (
            <BookmarkListCard key={list.id} list={list} userId={userId ?? ""} />
          ))}
        </div>
      )}
    </div>
  );
}
