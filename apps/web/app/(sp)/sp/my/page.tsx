"use client";

import type { PublicProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { BookmarkListCard } from "@/app/users/[userId]/page";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";

export default function SpMyPage() {
  const { data: session } = useSession();

  useEffect(() => {
    document.title = pageTitle("マイページ");
  }, []);

  const user = session?.user;
  const userId = user?.id;
  const displayUsername = user?.displayUsername ?? user?.username;

  const { data: profile, isLoading } = useQuery({
    queryKey: queryKeys.profile.bookmarkLists(userId ?? ""),
    queryFn: () => api<PublicProfileResponse>(`/api/users/${userId}/bookmark-lists`),
    enabled: !!userId,
  });
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <div className="mt-4 mx-auto max-w-2xl space-y-4">
      {/* Profile header */}
      <div className="flex flex-col items-center gap-3 py-6">
        <UserAvatar
          name={user?.name ?? ""}
          image={user?.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <div className="text-center">
          <h1 className="text-lg font-semibold">{user?.name}</h1>
          {displayUsername && <p className="text-sm text-muted-foreground">@{displayUsername}</p>}
        </div>
        <Link
          href="/sp/my/edit"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border px-4 text-sm hover:bg-accent"
        >
          <Pencil className="h-3 w-3" />
          プロフィールを編集
        </Link>
      </div>

      {/* Bookmark lists */}
      {showSkeleton && (
        <div className="overflow-hidden rounded-lg border divide-y">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none" />
          ))}
        </div>
      )}
      {!showSkeleton && profile && profile.bookmarkLists.length > 0 && (
        <div className="overflow-hidden rounded-lg border divide-y">
          {profile.bookmarkLists.map((list) => (
            <BookmarkListCard key={list.id} list={list} userId={userId ?? ""} />
          ))}
        </div>
      )}
    </div>
  );
}
