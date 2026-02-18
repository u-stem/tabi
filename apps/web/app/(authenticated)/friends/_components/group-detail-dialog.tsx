"use client";

import type { FriendResponse, GroupMemberResponse, GroupResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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

  const groupId = group?.id ?? "";

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.groups.members(groupId),
    queryFn: () => api<GroupMemberResponse[]>(`/api/groups/${groupId}/members`),
    enabled: group !== null,
  });

  const { data: friends = [] } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    enabled: group !== null,
  });

  const memberUserIds = new Set(members.map((m) => m.userId));

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.members(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
  };

  async function handleRemoveMember() {
    if (!removingMember) return;
    try {
      await api(`/api/groups/${groupId}/members/${removingMember.userId}`, { method: "DELETE" });
      toast.success(MSG.GROUP_MEMBER_REMOVED);
      setRemovingMember(null);
      invalidateAll();
    } catch (err) {
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
    <>
      <Dialog
        open={group !== null}
        onOpenChange={(v) => {
          if (!v) {
            onOpenChange(false);
            setUserId("");
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
            {membersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
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
              <Tabs defaultValue="friends">
                <TabsList className="w-full">
                  <TabsTrigger value="friends" className="flex-1">
                    フレンドから
                  </TabsTrigger>
                  <TabsTrigger value="userId" className="flex-1">
                    IDで追加
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="friends">
                  {(() => {
                    const addable = friends.filter((f) => !memberUserIds.has(f.userId));
                    if (friends.length === 0) {
                      return (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          フレンドがいません
                        </p>
                      );
                    }
                    if (addable.length === 0) {
                      return (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          全員追加済みです
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "25vh" }}>
                        {addable.map((friend) => (
                          <div
                            key={friend.friendId}
                            className="flex items-center justify-between gap-2 rounded-md border p-2"
                          >
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
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
