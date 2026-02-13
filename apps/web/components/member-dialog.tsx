"use client";

import type { FriendResponse, MemberResponse } from "@sugara/shared";
import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { MSG } from "@/lib/messages";

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
  const [members, setMembers] = useState<MemberResponse[]>([]);
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("editor");
  const [friendRole, setFriendRole] = useState("editor");
  const [adding, setAdding] = useState(false);
  const [sendFriendRequest, setSendFriendRequest] = useState(true);
  const [removeMember, setRemoveMember] = useState<MemberResponse | null>(null);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<MemberResponse[]>(`/api/trips/${tripId}/members`);
      setMembers(data);
    } catch {
      toast.error(MSG.MEMBER_LIST_FAILED);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  const fetchFriends = useCallback(async () => {
    try {
      const data = await api<FriendResponse[]>("/api/friends");
      setFriends(data);
    } catch {
      // Non-critical, silently ignore
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchFriends();
    }
  }, [open, fetchMembers, fetchFriends]);

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
      fetchMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : MSG.MEMBER_ADD_FAILED;
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
      fetchMembers();
    } catch (err) {
      const message = err instanceof Error ? err.message : MSG.MEMBER_ADD_FAILED;
      toast.error(message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await api(`/api/trips/${tripId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      toast.success(MSG.MEMBER_ROLE_CHANGED);
      fetchMembers();
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
      fetchMembers();
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
            <p className="text-sm text-muted-foreground">読み込み中...</p>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "40vh" }}>
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-md border p-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                  </div>
                  {member.role === "owner" ? (
                    <span className="shrink-0 text-xs text-muted-foreground">オーナー</span>
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
                        className="text-xs text-muted-foreground hover:text-destructive"
                        aria-label={`${member.name}を削除`}
                        onClick={() => setRemoveMember(member)}
                      >
                        削除
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
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
                    <TabsTrigger value="userId" className="flex-1">
                      ユーザーIDで追加
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="friends">
                    {friends.length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        フレンドがいません
                      </p>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-end gap-2 py-1">
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
                          {friends.map((friend) => {
                            const isMember = memberUserIds.has(friend.userId);
                            return (
                              <div
                                key={friend.friendId}
                                className="flex items-center justify-between gap-2 rounded-md border p-2"
                              >
                                <p
                                  className={`truncate text-sm ${isMember ? "text-muted-foreground" : "font-medium"}`}
                                >
                                  {friend.name}
                                </p>
                                {isMember ? (
                                  <span className="shrink-0 text-xs text-muted-foreground">
                                    追加済み
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={adding}
                                    onClick={() => handleAddFriend(friend.userId)}
                                  >
                                    追加
                                  </Button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="userId">
                    <form onSubmit={handleAdd} className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          id="member-user-id"
                          name="userId"
                          type="text"
                          placeholder="ユーザーID"
                          value={userId}
                          onChange={(e) => setUserId(e.target.value)}
                          required
                          className="flex-1"
                        />
                        <Select value={role} onValueChange={setRole}>
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="editor">編集者</SelectItem>
                            <SelectItem value="viewer">閲覧者</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
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
                      <DialogFooter>
                        <Button type="submit" size="sm" disabled={adding}>
                          <UserPlus className="h-4 w-4" />
                          {adding ? "追加中..." : "追加"}
                        </Button>
                      </DialogFooter>
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
            <AlertDialogAction
              onClick={() => {
                if (removeMember) handleRemove(removeMember.userId);
                setRemoveMember(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
