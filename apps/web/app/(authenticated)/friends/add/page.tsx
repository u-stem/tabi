"use client";

import type { UserProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

export default function FriendsAddPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.users.profile(userId ?? ""),
    queryFn: () => api<UserProfileResponse>(`/api/users/${userId}/profile`),
    enabled: !!userId,
    retry: false,
  });

  if (!userId) {
    return (
      <div className="mt-4 mx-auto max-w-sm px-4">
        <p className="text-sm text-muted-foreground text-center">ユーザーIDが指定されていません</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-4 mx-auto max-w-sm px-4">
        <div className="flex flex-col items-center gap-6 rounded-lg border p-8">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mt-4 mx-auto max-w-sm px-4">
        <p className="text-sm text-muted-foreground text-center">ユーザーが見つかりません</p>
      </div>
    );
  }

  const isSelf = currentUserId === userId;

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
    <div className="mt-4 mx-auto max-w-sm px-4">
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
        {isSelf ? (
          <p className="text-sm text-muted-foreground">自分自身にはフレンド申請できません</p>
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
