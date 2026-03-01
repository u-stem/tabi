import type { FriendRequestResponse, FriendResponse, GroupResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { useDelayedLoading } from "@/lib/hooks/use-delayed-loading";
import { queryKeys } from "@/lib/query-keys";

export type UseFriendsPageReturn = {
  friends: FriendResponse[];
  requests: FriendRequestResponse[];
  groups: GroupResponse[];
  isLoading: boolean;
  showSkeleton: boolean;
};

export function useFriendsPage(isGuest: boolean): UseFriendsPageReturn {
  const friendsQuery = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    enabled: !isGuest,
  });
  useAuthRedirect(friendsQuery.error);

  const requestsQuery = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
    enabled: !isGuest,
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => api<GroupResponse[]>("/api/groups"),
    enabled: !isGuest,
  });

  const isLoading = friendsQuery.isLoading || requestsQuery.isLoading || groupsQuery.isLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  return {
    friends: friendsQuery.data ?? [],
    requests: requestsQuery.data ?? [],
    groups: groupsQuery.data ?? [],
    isLoading,
    showSkeleton,
  };
}
