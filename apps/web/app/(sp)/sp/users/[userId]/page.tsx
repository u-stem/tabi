"use client";

import type { PublicProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { ErrorMessage, ProfileContent, ProfileSkeletonContent } from "@/app/users/[userId]/page";
import { ApiError, api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";

export default function SpProfilePage() {
  const params = useParams();
  const userId = typeof params.userId === "string" ? params.userId : null;

  const {
    data: profile,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.profile.bookmarkLists(userId ?? ""),
    queryFn: () => api<PublicProfileResponse>(`/api/users/${userId}/bookmark-lists`),
    enabled: userId !== null,
  });

  const showSkeleton = useDelayedLoading(isLoading);

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

  if (showSkeleton) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <ProfileSkeletonContent />
      </div>
    );
  }

  if (isLoading) return null;

  if (error) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <ErrorMessage message={error} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mt-4 mx-auto max-w-2xl">
        <ErrorMessage message="ユーザーが見つかりません" />
      </div>
    );
  }

  return (
    <div className="mt-4 mx-auto max-w-2xl">
      <ProfileContent profile={profile} userId={userId ?? ""} />
    </div>
  );
}
