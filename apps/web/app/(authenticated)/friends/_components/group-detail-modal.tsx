"use client";

import type { FriendResponse, GroupMemberResponse, GroupResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

type Props = {
  group: GroupResponse | null;
  onOpenChange: (open: boolean) => void;
};

export function GroupDetailModal({ group, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const groupId = group?.id ?? "";

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.groups.members(groupId),
    queryFn: () => api<GroupMemberResponse[]>(`/api/groups/${groupId}/members`),
    enabled: groupId !== "",
    ...QUERY_CONFIG.stable,
  });

  const { data: friends = [] } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    enabled: groupId !== "",
    ...QUERY_CONFIG.stable,
  });

  const memberUserIds = new Set(members.map((m) => m.userId));
  const addableFriends = friends.filter((f) => !memberUserIds.has(f.userId));

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.members(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
  };

  async function handleRemoveMember(memberId: string) {
    setRemovingMemberId(memberId);

    const cacheKey = queryKeys.groups.members(groupId);
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<GroupMemberResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((m) => m.userId !== memberId),
      );
    }
    toast.success(MSG.GROUP_MEMBER_REMOVED);

    try {
      await api(`/api/groups/${groupId}/members/${memberId}`, { method: "DELETE" });
      invalidateAll();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.GROUP_MEMBER_REMOVE_FAILED));
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function handleAddById(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = userId.trim();
    if (!trimmed) return;

    setAdding(true);
    try {
      await api(`/api/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: trimmed }),
      });
      toast.success(MSG.GROUP_MEMBER_ADDED);
      setUserId("");
      invalidateAll();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, MSG.GROUP_MEMBER_ADD_FAILED, {
          badRequest: MSG.INVALID_USER_ID,
          notFound: MSG.USER_NOT_FOUND,
          conflict: MSG.GROUP_MEMBER_ALREADY,
        }),
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleAddFriend(friendUserId: string) {
    setAddingFriendId(friendUserId);
    try {
      await api(`/api/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: friendUserId }),
      });
      toast.success(MSG.GROUP_MEMBER_ADDED);
      invalidateAll();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.GROUP_MEMBER_ADD_FAILED));
    } finally {
      setAddingFriendId(null);
    }
  }

  return (
    <ResponsiveDialog open={group !== null} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="flex min-h-[92vh] max-h-[92vh] flex-col overflow-hidden">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{group?.name ?? "グループ"}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {/* Add by ID */}
        <div className="border-b pb-3">
          <form onSubmit={handleAddById} className="flex gap-2">
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ユーザーIDで追加"
              required
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={adding || !userId.trim()}>
              <UserPlus className="h-4 w-4" />
              {adding ? "..." : "追加"}
            </Button>
          </form>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Addable friends */}
          {addableFriends.length > 0 && (
            <div className="border-b pb-2">
              <p className="py-2 text-sm font-medium text-muted-foreground">フレンドから追加</p>
              <div className="divide-y divide-border">
                {addableFriends.map((friend) => (
                  <div key={friend.friendId} className="flex items-center gap-3 py-2">
                    <UserAvatar
                      name={friend.name}
                      image={friend.image}
                      className="h-8 w-8 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{friend.name}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={addingFriendId === friend.userId}
                      onClick={() => handleAddFriend(friend.userId)}
                    >
                      <UserPlus className="h-4 w-4" />
                      {addingFriendId === friend.userId ? "..." : "追加"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member list */}
          <div>
            <p className="py-2 text-sm font-medium text-muted-foreground">
              メンバー ({members.length})
            </p>
            {membersLoading ? (
              <SkeletonGroup className="px-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <SkeletonBone className="h-10 w-10 rounded-full" />
                    <SkeletonBone className="h-4 w-28" />
                  </div>
                ))}
              </SkeletonGroup>
            ) : members.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{MSG.EMPTY_MEMBER}</p>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <div key={member.userId} className="flex items-center gap-3 py-3">
                    <UserAvatar
                      name={member.name}
                      image={member.image}
                      className="h-10 w-10 shrink-0"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {member.name}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={removingMemberId === member.userId}
                      onClick={() => handleRemoveMember(member.userId)}
                    >
                      <UserMinus className="h-4 w-4" />
                      削除
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
