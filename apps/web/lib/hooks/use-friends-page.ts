import type {
  FriendRequestResponse,
  FriendResponse,
  GroupResponse,
  SentFriendRequestResponse,
} from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export type UseFriendsPageReturn = {
  friends: FriendResponse[];
  requests: FriendRequestResponse[];
  sentRequests: SentFriendRequestResponse[];
  groups: GroupResponse[];
  isLoading: boolean;
};

export function useFriendsPage(isGuest: boolean): UseFriendsPageReturn {
  const friendsQuery = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    enabled: !isGuest,
    ...QUERY_CONFIG.stable,
  });
  useAuthRedirect(friendsQuery.error);

  const requestsQuery = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
    enabled: !isGuest,
    ...QUERY_CONFIG.stable,
  });

  const sentRequestsQuery = useQuery({
    queryKey: queryKeys.friends.sentRequests(),
    queryFn: () => api<SentFriendRequestResponse[]>("/api/friends/requests/sent"),
    enabled: !isGuest,
    ...QUERY_CONFIG.stable,
  });

  const groupsQuery = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => api<GroupResponse[]>("/api/groups"),
    enabled: !isGuest,
    ...QUERY_CONFIG.stable,
  });

  const isLoading =
    friendsQuery.isLoading ||
    requestsQuery.isLoading ||
    sentRequestsQuery.isLoading ||
    groupsQuery.isLoading;

  return {
    friends: friendsQuery.data ?? [],
    requests: requestsQuery.data ?? [],
    sentRequests: sentRequestsQuery.data ?? [],
    groups: groupsQuery.data ?? [],
    isLoading,
  };
}
