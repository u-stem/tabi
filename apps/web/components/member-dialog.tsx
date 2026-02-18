"use client";

import type {
  FriendResponse,
  GroupMemberResponse,
  GroupResponse,
  MemberResponse,
} from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type MemberDialogProps = {
  tripId: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberLimitReached?: boolean;
};

export function MemberDialog({
  tripId,
  isOwner,
  open,
  onOpenChange,
  memberLimitReached,
}: MemberDialogProps) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("editor");
  const [friendRole, setFriendRole] = useState("editor");
  const [adding, setAdding] = useState(false);
  const [sendFriendRequest, setSendFriendRequest] = useState(true);
  const [removeMember, setRemoveMember] = useState<MemberResponse | null>(null);
  const [groupRole, setGroupRole] = useState("editor");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: members = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.trips.members(tripId),
    queryFn: () => api<MemberResponse[]>(`/api/trips/${tripId}/members`),
    enabled: open,
  });

  const { data: friends = [] } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    enabled: open,
  });

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => api<GroupResponse[]>("/api/groups"),
    enabled: open,
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: queryKeys.groups.members(selectedGroupId ?? ""),
    queryFn: () => api<GroupMemberResponse[]>(`/api/groups/${selectedGroupId}/members`),
    enabled: open && selectedGroupId !== null,
  });

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.members(tripId) });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      });
      toast.success(MSG.MEMBER_ADDED);
      if (sendFriendRequest) {
        // Send friend request silently - ignore errors (already friends, etc.)
        api("/api/friends/requests", {
          method: "POST",
          body: JSON.stringify({ addresseeId: userId }),
        }).catch(() => {});
      }
      setUserId("");
      invalidateMembers();
    } catch (err) {
      const message = getApiErrorMessage(err, MSG.MEMBER_ADD_FAILED);
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  async function handleAddFriend(friendUserId: string) {
    setAdding(true);
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: friendUserId, role: friendRole }),
      });
      toast.success(MSG.MEMBER_ADDED);
      invalidateMembers();
    } catch (err) {
      const message = getApiErrorMessage(err, MSG.MEMBER_ADD_FAILED);
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  async function handleAddGroupMembers() {
    const toAdd = groupMembers.filter((m) => !memberUserIds.has(m.userId));
    if (toAdd.length === 0) return;

    setAdding(true);
    const results = await Promise.allSettled(
      toAdd.map((m) =>
        api(`/api/trips/${tripId}/members`, {
          method: "POST",
          body: JSON.stringify({ userId: m.userId, role: groupRole }),
        }),
      ),
    );
    const added = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === 0) {
      toast.success(MSG.GROUP_BULK_ADDED(added));
    } else if (added > 0) {
      toast.warning(MSG.GROUP_BULK_ADD_PARTIAL(added, failed));
    } else {
      toast.error(MSG.MEMBER_ADD_FAILED);
    }
    invalidateMembers();
    setAdding(false);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await api(`/api/trips/${tripId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      toast.success(MSG.MEMBER_ROLE_CHANGED);
      invalidateMembers();
    } catch {
      toast.error(MSG.MEMBER_ROLE_CHANGE_FAILED);
    }
  }

  async function handleRemove(userId: string) {
    try {
      await api(`/api/trips/${tripId}/members/${userId}`, {
        method: "DELETE",
      });
      toast.success(MSG.MEMBER_REMOVED);
      invalidateMembers();
    } catch {
      toast.error(MSG.MEMBER_REMOVE_FAILED);
    }
  }

  const memberUserIds = new Set(members.map((m) => m.userId));

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setUserId("");
          setRole("editor");
          setFriendRole("editor");
          setGroupRole("editor");
          setSelectedGroupId(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>メンバー管理</DialogTitle>
          <DialogDescription>旅行メンバーの招待と権限を管理します</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4">
          {loading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-[100px]" />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-7 w-[100px]" />
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border p-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-[100px]" />
              </div>
            </div>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "40vh" }}>
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <UserAvatar
                      name={member.name}
                      image={member.image}
                      className="h-6 w-6 shrink-0"
                      fallbackClassName="text-xs"
                    />
                    <p className="truncate text-sm font-medium">{member.name}</p>
                  </div>
                  {member.role === "owner" ? (
                    <span className="shrink-0 select-none text-xs text-muted-foreground">
                      オーナー
                    </span>
                  ) : isOwner ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Select
                        value={member.role}
                        onValueChange={(v) => handleRoleChange(member.userId, v)}
                      >
                        <SelectTrigger className="h-7 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">編集者</SelectItem>
                          <SelectItem value="viewer">閲覧者</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        className="select-none text-xs text-muted-foreground hover:text-destructive"
                        aria-label={`${member.name}を削除`}
                        onClick={() => setRemoveMember(member)}
                      >
                        削除
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 select-none text-xs text-muted-foreground">
                      {member.role === "editor" ? "編集者" : "閲覧者"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && (
            <div className="space-y-3 border-t pt-3">
              <Label className="text-sm font-medium">メンバーを追加</Label>
              {memberLimitReached ? (
                <p className="text-sm text-muted-foreground">{MSG.LIMIT_MEMBERS}</p>
              ) : (
                <Tabs defaultValue="friends">
                  <TabsList className="w-full">
                    <TabsTrigger value="friends" className="flex-1">
                      フレンドから
                    </TabsTrigger>
                    <TabsTrigger value="groups" className="flex-1">
                      グループから
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
                        <div className="space-y-2">
                          <div className="flex select-none items-center justify-end gap-2 py-1">
                            <span className="text-xs text-muted-foreground">ロール:</span>
                            <Select value={friendRole} onValueChange={setFriendRole}>
                              <SelectTrigger className="h-7 w-[100px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="editor">編集者</SelectItem>
                                <SelectItem value="viewer">閲覧者</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "30vh" }}>
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
                        </div>
                      );
                    })()}
                  </TabsContent>

                  <TabsContent value="groups">
                    {groups.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        グループがありません
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex select-none items-center justify-between gap-2 py-1">
                          <Select value={selectedGroupId ?? ""} onValueChange={setSelectedGroupId}>
                            <SelectTrigger className="h-7 flex-1 text-xs">
                              <SelectValue placeholder="グループを選択" />
                            </SelectTrigger>
                            <SelectContent>
                              {groups.map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                  {g.name} ({g.memberCount})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">ロール:</span>
                          <Select value={groupRole} onValueChange={setGroupRole}>
                            <SelectTrigger className="h-7 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="editor">編集者</SelectItem>
                              <SelectItem value="viewer">閲覧者</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedGroupId &&
                          (() => {
                            const addable = groupMembers.filter(
                              (gm) => !memberUserIds.has(gm.userId),
                            );
                            if (addable.length === 0) {
                              return (
                                <p className="py-4 text-center text-sm text-muted-foreground">
                                  全員追加済みです
                                </p>
                              );
                            }
                            return (
                              <>
                                <div
                                  className="space-y-2 overflow-y-auto"
                                  style={{ maxHeight: "25vh" }}
                                >
                                  {addable.map((gm) => (
                                    <div
                                      key={gm.userId}
                                      className="flex items-center justify-between gap-2 rounded-md border p-2"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <UserAvatar
                                          name={gm.name}
                                          image={gm.image}
                                          className="h-6 w-6 shrink-0"
                                          fallbackClassName="text-xs"
                                        />
                                        <p className="truncate text-sm font-medium">{gm.name}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <Button
                                  size="sm"
                                  className="w-full"
                                  disabled={adding}
                                  onClick={handleAddGroupMembers}
                                >
                                  {adding ? "追加中..." : "全員追加"}
                                </Button>
                              </>
                            );
                          })()}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="userId">
                    <form onSubmit={handleAdd} className="space-y-3">
                      <div className="flex select-none items-center justify-end gap-2 py-1">
                        <div className="flex items-center gap-2 me-auto">
                          <Checkbox
                            id="send-friend-request"
                            checked={sendFriendRequest}
                            onCheckedChange={(checked) => setSendFriendRequest(checked === true)}
                          />
                          <Label
                            htmlFor="send-friend-request"
                            className="text-xs text-muted-foreground"
                          >
                            フレンド申請も送る
                          </Label>
                        </div>
                        <span className="text-xs text-muted-foreground">ロール:</span>
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger className="h-7 w-[100px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="editor">編集者</SelectItem>
                            <SelectItem value="viewer">閲覧者</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          id="member-user-id"
                          name="userId"
                          type="text"
                          placeholder="550e8400-e29b-41d4-..."
                          value={userId}
                          onChange={(e) => setUserId(e.target.value)}
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
              )}
            </div>
          )}
        </div>
      </DialogContent>
      <AlertDialog open={removeMember !== null} onOpenChange={(v) => !v && setRemoveMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>メンバーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{removeMember?.name}」を旅行から削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction
              onClick={() => {
                if (removeMember) handleRemove(removeMember.userId);
                setRemoveMember(null);
              }}
            >
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
