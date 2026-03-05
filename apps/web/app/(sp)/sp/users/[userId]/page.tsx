"use client";

import type { PublicProfileResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect } from "react";

import { ErrorMessage, ProfileContent, ProfileSkeletonContent } from "@/app/users/[userId]/page";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { ApiError, api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { QUERY_CONFIG } from "@/lib/query-config";
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
    ...QUERY_CONFIG.stable,
  });

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

  return (
    <LoadingBoundary
      isLoading={isLoading}
      skeleton={
        <div className="mx-auto mt-4 max-w-2xl">
          <ProfileSkeletonContent />
        </div>
      }
    >
      <div className="mx-auto mt-4 max-w-2xl">
        {error || !profile ? (
          <ErrorMessage message={error ?? "ユーザーが見つかりません"} />
        ) : (
          <ProfileContent profile={profile} userId={userId ?? ""} />
        )}
      </div>
    </LoadingBoundary>
  );
}
