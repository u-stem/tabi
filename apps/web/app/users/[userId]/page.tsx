"use client";

import type { BookmarkListResponse, BookmarkResponse, PublicProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronRight, ExternalLink, List } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { isSafeUrl, stripProtocol } from "@/lib/format";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";

type BookmarkListDetail = BookmarkListResponse & {
  bookmarks: BookmarkResponse[];
};

function ProfileHeader() {
  return (
    <header className="border-b">
      <div className="container flex h-14 items-center">
        <Logo />
        <span className="ml-2 text-sm text-muted-foreground">公開プロフィール</span>
      </div>
    </header>
  );
}

function ProfileSkeletonContent() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function BookmarkListCard({ list, userId }: { list: BookmarkListResponse; userId: string }) {
  const [expanded, setExpanded] = useState(false);

  const {
    data: detail,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.profile.bookmarkList(userId, list.id),
    queryFn: () => api<BookmarkListDetail>(`/api/users/${userId}/bookmark-lists/${list.id}`),
    // Only fetch when expanded
    enabled: expanded,
  });

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none transition-colors hover:bg-accent/50"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base">
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            <span className="truncate">{list.name}</span>
          </CardTitle>
          <Badge variant="secondary">{list.bookmarkCount}</Badge>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">ブックマークの読み込みに失敗しました</p>
          )}

          {detail && detail.bookmarks.length === 0 && (
            <p className="text-sm text-muted-foreground">ブックマークがありません</p>
          )}

          {detail && detail.bookmarks.length > 0 && (
            <ul className="divide-y">
              {detail.bookmarks.map((bookmark) => (
                <li key={bookmark.id} className="py-2">
                  <div className="flex items-start gap-2">
                    <Bookmark className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{bookmark.name}</p>
                      {bookmark.memo && (
                        <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">
                          {bookmark.memo}
                        </p>
                      )}
                      {(bookmark.urls ?? []).map(
                        (url) =>
                          isSafeUrl(url) && (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 flex w-fit max-w-full items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{stripProtocol(url)}</span>
                            </a>
                          ),
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ProfileContent({ profile, userId }: { profile: PublicProfileResponse; userId: string }) {
  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <UserAvatar
          name={profile.name}
          image={profile.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <h1 className="min-w-0 truncate text-xl font-bold">{profile.name}</h1>
      </div>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Bookmark className="h-5 w-5 text-muted-foreground" />
          ブックマークリスト
        </h2>
        {profile.bookmarkLists.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-muted-foreground">リストがありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.bookmarkLists.map((list) => (
              <BookmarkListCard key={list.id} list={list} userId={userId} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <List className="mb-4 h-12 w-12 text-muted-foreground" />
      <p className="text-lg font-medium text-destructive">{message}</p>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.userId as string;
  const { data: session, isPending: isSessionPending } = useSession();
  const isAuthenticated = !isSessionPending && !!session;

  const {
    data: profile,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.profile.bookmarkLists(userId),
    queryFn: () => api<PublicProfileResponse>(`/api/users/${userId}/bookmark-lists`),
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // Set document title when profile is loaded
  useEffect(() => {
    if (profile) {
      document.title = pageTitle(`${profile.name} のプロフィール`);
    }
  }, [profile]);

  const error =
    queryError instanceof ApiError && queryError.status === 404
      ? "ユーザーが見つかりません"
      : queryError
        ? "プロフィールの読み込みに失敗しました"
        : null;

  // Authenticated: layout provides Header + BottomNav + container
  if (isAuthenticated) {
    if (showSkeleton) {
      return <ProfileSkeletonContent />;
    }
    if (isLoading) {
      return null;
    }
    if (error) {
      return (
        <div className="mx-auto max-w-2xl">
          <ErrorMessage message={error} />
        </div>
      );
    }
    if (!profile) {
      return (
        <div className="mx-auto max-w-2xl">
          <ErrorMessage message="ユーザーが見つかりません" />
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-2xl">
        <ProfileContent profile={profile} userId={userId} />
      </div>
    );
  }

  // Public: page handles full layout with ProfileHeader
  if (showSkeleton) {
    return (
      <div className="min-h-screen">
        <ProfileHeader />
        <div className="container max-w-2xl py-8">
          <ProfileSkeletonContent />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <ProfileHeader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <ProfileHeader />
        <div className="container max-w-2xl">
          <ErrorMessage message={error} />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen">
        <ProfileHeader />
        <div className="container max-w-2xl">
          <ErrorMessage message="ユーザーが見つかりません" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ProfileHeader />
      <div className="container max-w-2xl py-8">
        <ProfileContent profile={profile} userId={userId} />
      </div>
    </div>
  );
}
