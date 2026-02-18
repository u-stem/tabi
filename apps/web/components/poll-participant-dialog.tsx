"use client";

import type { FriendResponse, GroupMemberResponse, GroupResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type Participant = { id: string; userId: string | null; name: string };

type PollParticipantDialogProps = {
  pollId: string;
  participants: Participant[];
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMutate: () => void;
};

export function PollParticipantDialog({
  pollId,
  participants,
  isOwner,
  open,
  onOpenChange,
  onMutate,
}: PollParticipantDialogProps) {
  const [userId, setUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Participant | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

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

  const participantUserIds = new Set(participants.map((p) => p.userId).filter(Boolean));

  async function handleAddByUserId(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api(`/api/polls/${pollId}/participants`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      toast.success(MSG.POLL_PARTICIPANT_ADDED);
      setUserId("");
      onMutate();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.POLL_PARTICIPANT_ADD_FAILED));
    } finally {
      setAdding(false);
    }
  }

  async function handleAddFriend(friendUserId: string) {
    setAdding(true);
    try {
      await api(`/api/polls/${pollId}/participants`, {
        method: "POST",
        body: JSON.stringify({ userId: friendUserId }),
      });
      toast.success(MSG.POLL_PARTICIPANT_ADDED);
      onMutate();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.POLL_PARTICIPANT_ADD_FAILED));
    } finally {
      setAdding(false);
    }
  }

  async function handleAddGroupMembers() {
    const toAdd = groupMembers.filter((m) => !participantUserIds.has(m.userId));
    if (toAdd.length === 0) return;

    setAdding(true);
    const results = await Promise.allSettled(
      toAdd.map((m) =>
        api(`/api/polls/${pollId}/participants`, {
          method: "POST",
          body: JSON.stringify({ userId: m.userId }),
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
      toast.error(MSG.POLL_PARTICIPANT_ADD_FAILED);
    }
    onMutate();
    setAdding(false);
  }

  async function handleRemove(participantId: string) {
    try {
      await api(`/api/polls/${pollId}/participants/${participantId}`, {
        method: "DELETE",
      });
      toast.success(MSG.POLL_PARTICIPANT_REMOVED);
      onMutate();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.POLL_PARTICIPANT_REMOVE_FAILED));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setUserId("");
          setSelectedGroupId(null);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>参加者管理</DialogTitle>
          <DialogDescription>日程調整の参加者を管理します</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-4">
          {/* Participant list */}
          <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "40vh" }}>
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <UserAvatar
                    name={p.name}
                    className="h-6 w-6 shrink-0"
                    fallbackClassName="text-xs"
                  />
                  <p className="truncate text-sm font-medium">{p.name}</p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    className="shrink-0 select-none text-xs text-muted-foreground hover:text-destructive"
                    aria-label={`${p.name}を削除`}
                    onClick={() => setRemoveTarget(p)}
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add participant section */}
          {isOwner && (
            <div className="space-y-3 border-t pt-3">
              <Label className="text-sm font-medium">参加者を追加</Label>
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
                    const addable = friends.filter((f) => !participantUserIds.has(f.userId));
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
                      <div className="flex select-none items-center gap-2 py-1">
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
                      </div>
                      {selectedGroupId &&
                        (() => {
                          const addable = groupMembers.filter(
                            (gm) => !participantUserIds.has(gm.userId),
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
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={adding}
                                  onClick={handleAddGroupMembers}
                                >
                                  {adding ? "追加中..." : "全員追加"}
                                </Button>
                              </div>
                            </>
                          );
                        })()}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="userId">
                  <form onSubmit={handleAddByUserId} className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        id="participant-user-id"
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
            </div>
          )}
        </div>
      </DialogContent>
      <AlertDialog open={removeTarget !== null} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>参加者を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{removeTarget?.name}」を日程調整から削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction
              onClick={() => {
                if (removeTarget) handleRemove(removeTarget.id);
                setRemoveTarget(null);
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
