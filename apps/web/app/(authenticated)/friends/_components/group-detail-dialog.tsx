"use client";

import type {
  BulkAddMembersResponse,
  FriendResponse,
  GroupMemberResponse,
  GroupResponse,
} from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, SquareMousePointer, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type GroupMembersDialogProps = {
  group: GroupResponse | null;
  onOpenChange: (open: boolean) => void;
};

export function GroupMembersDialog({ group, onOpenChange }: GroupMembersDialogProps) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const [removingMember, setRemovingMember] = useState<GroupMemberResponse | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const groupId = group?.id ?? "";

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.groups.members(groupId),
    queryFn: () => api<GroupMemberResponse[]>(`/api/groups/${groupId}/members`),
    enabled: group !== null,
  });

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    enabled: group !== null,
  });

  const dataLoading = membersLoading || friendsLoading;
  const memberUserIds = new Set(members.map((m) => m.userId));
  const addable = friends.filter((f) => !memberUserIds.has(f.userId));

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
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(addable.map((f) => f.userId)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  async function handleRemoveMember() {
    if (!removingMember) return;
    const memberId = removingMember.userId;

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
    setRemovingMember(null);

    try {
      await api(`/api/groups/${groupId}/members/${memberId}`, { method: "DELETE" });
      invalidateAll();
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.GROUP_MEMBER_REMOVE_FAILED));
    }
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

  const selectedCount = selectedIds.size;

  return (
    <>
      <Dialog
        open={group !== null}
        onOpenChange={(v) => {
          if (!v) {
            onOpenChange(false);
            setUserId("");
            exitSelectionMode();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{group?.name}</DialogTitle>
            <DialogDescription>{members.length}人のメンバー</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-4">
            {/* Member list */}
            {dataLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                まだメンバーがいません
              </p>
            ) : (
              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "30vh" }}>
                {members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={member.name}
                        image={member.image}
                        className="h-6 w-6 shrink-0"
                        fallbackClassName="text-xs"
                      />
                      <span className="text-sm font-medium truncate">{member.name}</span>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 select-none text-xs text-muted-foreground hover:text-destructive"
                      aria-label={`${member.name}を削除`}
                      onClick={() => setRemovingMember(member)}
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add member section */}
            <div className="space-y-3 border-t pt-3">
              <Label className="text-sm font-medium">メンバーを追加</Label>
              <Tabs defaultValue="friends" onValueChange={() => exitSelectionMode()}>
                <TabsList className="w-full">
                  <TabsTrigger value="friends" className="flex-1">
                    フレンドから
                  </TabsTrigger>
                  <TabsTrigger value="userId" className="flex-1">
                    IDで追加
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="friends">
                  {friends.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      フレンドがいません
                    </p>
                  ) : addable.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      全員追加済みです
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {/* Selection mode toolbar */}
                      {selectionMode ? (
                        <div className="flex items-center gap-1.5">
                          <Button variant="outline" size="sm" onClick={selectAll}>
                            <CheckCheck className="h-4 w-4" />
                            全選択
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={deselectAll}
                            disabled={selectedCount === 0}
                          >
                            <X className="h-4 w-4" />
                            選択解除
                          </Button>
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Button
                              size="sm"
                              disabled={selectedCount === 0 || adding}
                              onClick={handleBulkAdd}
                            >
                              <UserPlus className="h-4 w-4" />
                              {adding
                                ? "追加中..."
                                : selectedCount === 0
                                  ? "追加"
                                  : `${selectedCount}人を追加`}
                            </Button>
                            <Button variant="outline" size="sm" onClick={exitSelectionMode}>
                              キャンセル
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectionMode(true)}
                          >
                            <SquareMousePointer className="h-4 w-4" />
                            選択
                          </Button>
                        </div>
                      )}

                      {/* Friend list */}
                      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "25vh" }}>
                        {addable.map((friend) => (
                          <div
                            key={friend.friendId}
                            className="flex items-center justify-between gap-2 rounded-md border p-2"
                          >
                            {selectionMode ? (
                              <label
                                htmlFor={`group-sel-${friend.userId}`}
                                className="flex flex-1 cursor-pointer items-center gap-2 min-w-0"
                              >
                                <Checkbox
                                  id={`group-sel-${friend.userId}`}
                                  checked={selectedIds.has(friend.userId)}
                                  onCheckedChange={() => toggleSelected(friend.userId)}
                                />
                                <UserAvatar
                                  name={friend.name}
                                  image={friend.image}
                                  className="h-6 w-6 shrink-0"
                                  fallbackClassName="text-xs"
                                />
                                <p className="truncate text-sm font-medium">{friend.name}</p>
                              </label>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 min-w-0">
                                  <UserAvatar
                                    name={friend.name}
                                    image={friend.image}
                                    className="h-6 w-6 shrink-0"
                                    fallbackClassName="text-xs"
                                  />
                                  <p className="truncate text-sm font-medium">{friend.name}</p>
                                </div>
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
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="userId">
                  <form onSubmit={handleAddById} className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        id="group-member-user-id"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        placeholder="550e8400-e29b-41d4-..."
                        required
                        className="flex-1"
                      />
                      <Button type="submit" size="sm" variant="outline" disabled={adding}>
                        <UserPlus className="h-4 w-4" />
                        {adding ? "追加中..." : "追加"}
                      </Button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove member confirmation */}
      <AlertDialog
        open={removingMember !== null}
        onOpenChange={(v) => !v && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>メンバーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{removingMember?.name}」をグループから削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction onClick={handleRemoveMember}>
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
