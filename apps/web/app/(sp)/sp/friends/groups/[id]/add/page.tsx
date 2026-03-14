"use client";

import type {
  BulkAddMembersResponse,
  FriendResponse,
  GroupMemberResponse,
  GroupResponse,
} from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCheck, SquareMousePointer, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export default function SpGroupAddMemberPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => api<GroupResponse[]>("/api/groups"),
    ...QUERY_CONFIG.stable,
  });
  const group = groups.find((g) => g.id === groupId);

  const { data: members = [] } = useQuery({
    queryKey: queryKeys.groups.members(groupId),
    queryFn: () => api<GroupMemberResponse[]>(`/api/groups/${groupId}/members`),
    ...QUERY_CONFIG.stable,
  });

  const { data: friends = [] } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    ...QUERY_CONFIG.stable,
  });

  useEffect(() => {
    document.title = pageTitle(group?.name ?? "メンバーを追加");
  }, [group?.name]);

  const memberUserIds = new Set(members.map((m) => m.userId));
  const addable = friends.filter((f) => !memberUserIds.has(f.userId));
  const selectedCount = selectedIds.size;

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.members(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
  };

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function toggleSelected(uid: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  async function handleAddFriend(friendUserId: string) {
    setAdding(true);
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
      setAdding(false);
    }
  }

  async function handleBulkAdd() {
    if (selectedIds.size === 0) return;
    setAdding(true);
    try {
      const result = await api<BulkAddMembersResponse>(`/api/groups/${groupId}/members/bulk`, {
        method: "POST",
        body: JSON.stringify({ userIds: [...selectedIds] }),
      });
      if (result.failed === 0) {
        toast.success(MSG.GROUP_BULK_ADDED(result.added));
      } else {
        toast.warning(MSG.GROUP_BULK_ADD_PARTIAL(result.added, result.failed));
      }
      exitSelectionMode();
      invalidateAll();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.GROUP_MEMBER_ADD_FAILED));
    } finally {
      setAdding(false);
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
      toast.error(getApiErrorMessage(err, MSG.GROUP_MEMBER_ADD_FAILED));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Nav bar */}
      <div className="relative mt-2 flex h-10 items-center px-4">
        <Link
          href={`/sp/friends/groups/${groupId}`}
          className="z-10 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Link>
        <span className="absolute inset-x-16 truncate text-center text-sm font-semibold">
          メンバーを追加
        </span>
      </div>

      <div className="mt-3 space-y-6 px-4">
        {/* Friend list */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">フレンドから追加</h3>
          {friends.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{MSG.EMPTY_FRIEND}</p>
          ) : addable.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{MSG.MEMBER_ALL_ADDED}</p>
          ) : (
            <>
              {/* Selection toolbar */}
              {selectionMode ? (
                <div className="mb-2 flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIds(new Set(addable.map((f) => f.userId)))}
                  >
                    <CheckCheck className="h-4 w-4" />
                    全選択
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    disabled={selectedCount === 0}
                  >
                    <X className="h-4 w-4" />
                    解除
                  </Button>
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      size="sm"
                      disabled={selectedCount === 0 || adding}
                      onClick={handleBulkAdd}
                    >
                      <UserPlus className="h-4 w-4" />
                      {adding ? "追加中..." : `${selectedCount}人を追加`}
                    </Button>
                    <Button variant="outline" size="sm" onClick={exitSelectionMode}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-2 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                    <SquareMousePointer className="h-4 w-4" />
                    選択
                  </Button>
                </div>
              )}
              <div className="divide-y divide-border rounded-lg border">
                {addable.map((friend) => (
                  <div key={friend.friendId} className="flex items-center gap-3 px-3 py-2.5">
                    {selectionMode ? (
                      <label
                        htmlFor={`sel-${friend.userId}`}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                      >
                        <Checkbox
                          id={`sel-${friend.userId}`}
                          checked={selectedIds.has(friend.userId)}
                          onCheckedChange={() => toggleSelected(friend.userId)}
                        />
                        <UserAvatar
                          name={friend.name}
                          image={friend.image}
                          className="h-8 w-8 shrink-0"
                        />
                        <span className="truncate text-sm">{friend.name}</span>
                      </label>
                    ) : (
                      <>
                        <UserAvatar
                          name={friend.name}
                          image={friend.image}
                          className="h-8 w-8 shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">{friend.name}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={adding}
                          onClick={() => handleAddFriend(friend.userId)}
                        >
                          追加
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Add by ID */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">IDで追加</h3>
          <form onSubmit={handleAddById} className="flex gap-2">
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ユーザーID"
              required
              className="flex-1"
            />
            <Button type="submit" size="sm" variant="outline" disabled={adding || !userId.trim()}>
              <UserPlus className="h-4 w-4" />
              {adding ? "追加中..." : "追加"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
