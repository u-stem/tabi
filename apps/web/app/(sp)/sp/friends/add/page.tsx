"use client";

import type { UserProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

export default function SpFriendsAddPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const { data: session, isPending: sessionLoading } = useSession();
  const currentUserId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [alreadyFriend, setAlreadyFriend] = useState(false);

  const isSelf = !!currentUserId && currentUserId === userId;

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.users.profile(userId ?? ""),
    queryFn: () => api<UserProfileResponse>(`/api/users/${userId}/profile`),
    enabled: !!userId && !sessionLoading && !isSelf,
    retry: false,
  });

  useEffect(() => {
    document.title = pageTitle("フレンド申請");
  }, []);

  useEffect(() => {
    if (isSelf) router.replace("/sp/my");
  }, [isSelf, router]);

  if (isSelf) return null;

  const skeleton = (
    <SkeletonGroup className="px-4 pt-4">
      <div className="flex flex-col items-center gap-6 rounded-lg border p-8">
        <SkeletonBone className="h-16 w-16 rounded-full" />
        <SkeletonBone className="h-5 w-32" />
        <SkeletonBone className="h-10 w-full" />
      </div>
    </SkeletonGroup>
  );

  if (sessionLoading || isLoading) return skeleton;

  if (!userId) {
    return (
      <div className="px-4 pt-4">
        <p className="text-sm text-muted-foreground text-center">ユーザーIDが指定されていません</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="px-4 pt-4">
        <p className="text-sm text-muted-foreground text-center">ユーザーが見つかりません</p>
      </div>
    );
  }

  async function handleSend() {
    setLoading(true);
    try {
      await api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeId: userId }),
      });
      setSent(true);
      toast.success(MSG.FRIEND_REQUEST_SENT);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyFriend(true);
      }
      toast.error(
        getApiErrorMessage(err, MSG.FRIEND_REQUEST_SEND_FAILED, {
          conflict: "すでにフレンドか申請済みです",
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-4 pt-4">
      <Link
        href="/sp/friends"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex flex-col items-center gap-6 rounded-lg border p-8">
        <UserAvatar
          name={profile.name}
          image={profile.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <div className="text-center">
          <h1 className="text-lg font-semibold">{profile.name}</h1>
        </div>
        {alreadyFriend ? (
          <p className="text-sm text-muted-foreground">すでにフレンドか申請済みです</p>
        ) : sent ? (
          <p className="text-sm text-muted-foreground">フレンド申請を送りました</p>
        ) : (
          <Button onClick={handleSend} disabled={loading} className="w-full">
            {loading ? "送信中..." : `${profile.name} さんにフレンド申請を送る`}
          </Button>
        )}
      </div>
    </div>
  );
}
