"use client";

import type {
  FriendResponse,
  GroupMemberResponse,
  GroupResponse,
  MemberResponse,
} from "@sugara/shared";
import { ROLE_LABELS } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight, Pencil, UserMinus, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { ItemMenuButton } from "@/components/item-menu-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogDestructiveAction,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
} from "@/components/ui/responsive-alert-dialog";
import { SkeletonBone, SkeletonGroup } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { ROLE_COLORS } from "@/lib/colors";
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export default function SpTripMembersPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const [sheetMember, setSheetMember] = useState<MemberResponse | null>(null);
  const [removeMember, setRemoveMember] = useState<MemberResponse | null>(null);
  const [roleChangeMember, setRoleChangeMember] = useState<MemberResponse | null>(null);
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);

  useEffect(() => {
    document.title = pageTitle("メンバー管理");
  }, []);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.trips.members(tripId),
    queryFn: () => api<MemberResponse[]>(`/api/trips/${tripId}/members`),
  });

  const currentUserId = session?.user?.id;
  const isOwner = members.some((m) => m.userId === currentUserId && m.role === "owner");

  const { data: friends = [] } = useQuery({
    queryKey: queryKeys.friends.list(),
    queryFn: () => api<FriendResponse[]>("/api/friends"),
    enabled: isOwner,
    ...QUERY_CONFIG.stable,
  });

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => api<GroupResponse[]>("/api/groups"),
    enabled: isOwner,
    ...QUERY_CONFIG.stable,
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: queryKeys.groups.members(selectedGroupId ?? ""),
    queryFn: () => api<GroupMemberResponse[]>(`/api/groups/${selectedGroupId}/members`),
    enabled: selectedGroupId !== null,
    ...QUERY_CONFIG.stable,
  });

  const memberUserIds = new Set(members.map((m) => m.userId));
  const addableFriends = friends.filter((f) => !memberUserIds.has(f.userId));
  const addableGroupMembers = groupMembers.filter((gm) => !memberUserIds.has(gm.userId));

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.trips.members(tripId) });

  async function handleAddById(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = userId.trim();
    if (!trimmed) return;

    setAdding(true);
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: trimmed, role: "editor" }),
      });
      toast.success(MSG.MEMBER_ADDED);
      // Already-friends or duplicate request are expected — ignore errors
      api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeId: trimmed }),
      }).catch(() => {});
      setUserId("");
      invalidateMembers();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, MSG.MEMBER_ADD_FAILED, {
          badRequest: MSG.INVALID_USER_ID,
          notFound: MSG.USER_NOT_FOUND,
          conflict: MSG.MEMBER_ALREADY,
        }),
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleAddFriend(friendUserId: string) {
    setAdding(true);
    try {
      await api(`/api/trips/${tripId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId: friendUserId, role: "editor" }),
      });
      toast.success(MSG.MEMBER_ADDED);
      invalidateMembers();
    } catch (err) {
      toast.error(
        getApiErrorMessage(err, MSG.MEMBER_ADD_FAILED, {
          conflict: MSG.MEMBER_ALREADY,
        }),
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleAddGroupMembers() {
    const toAdd = addableGroupMembers;
    if (toAdd.length === 0) return;

    setAdding(true);
    const results = await Promise.allSettled(
      toAdd.map((m) =>
        api(`/api/trips/${tripId}/members`, {
          method: "POST",
          body: JSON.stringify({ userId: m.userId, role: "editor" }),
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

  async function handleRoleChange(memberId: string, newRole: string) {
    const cacheKey = queryKeys.trips.members(tripId);
    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<MemberResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.map((m) => (m.userId !== memberId ? m : { ...m, role: newRole })),
      );
    }
    toast.success(MSG.MEMBER_ROLE_CHANGED);
    setRoleChangeMember(null);

    try {
      await api(`/api/trips/${tripId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      invalidateMembers();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.MEMBER_ROLE_CHANGE_FAILED);
    }
  }

  async function handleRemove(memberId: string) {
    const cacheKey = queryKeys.trips.members(tripId);
    await queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<MemberResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((m) => m.userId !== memberId),
      );
    }
    toast.success(MSG.MEMBER_REMOVED);

    try {
      await api(`/api/trips/${tripId}/members/${memberId}`, { method: "DELETE" });
      invalidateMembers();
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.MEMBER_REMOVE_FAILED);
    }
  }

  const sheetActions = sheetMember
    ? [
        ...(sheetMember.role !== "owner"
          ? [
              {
                label: "ロールを変更",
                icon: <Pencil className="h-4 w-4" />,
                onClick: () => {
                  setRoleChangeMember(sheetMember);
                  setSheetMember(null);
                },
              },
            ]
          : []),
        ...(!sheetMember.hasExpenses && sheetMember.role !== "owner"
          ? [
              {
                label: "メンバーを削除",
                icon: <UserMinus className="h-4 w-4" />,
                variant: "destructive" as const,
                onClick: () => {
                  setRemoveMember(sheetMember);
                  setSheetMember(null);
                },
              },
            ]
          : []),
      ]
    : [];

  return (
    <>
      {/* Nav bar */}
      <div className="relative mt-2 flex h-10 items-center px-4">
        <Link
          href={`/sp/trips/${tripId}`}
          className="z-10 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="absolute inset-x-16 truncate text-center text-sm font-semibold">
          メンバー
        </span>
      </div>

      <div className="mt-3">
        {/* Add section (owner only) */}
        {isOwner && (
          <div className="px-4">
            {/* Add by ID */}
            <div className="border-b pb-4">
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
              <p className="mt-1.5 text-sm text-muted-foreground">
                編集者として追加されます。ロールはあとから変更できます。
              </p>
            </div>

            {/* Friends */}
            {addableFriends.length > 0 && (
              <div className="border-b pb-3">
                <p className="pt-4 pb-2 text-sm font-medium text-muted-foreground">
                  フレンドから追加
                </p>
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
                        disabled={adding}
                        onClick={() => handleAddFriend(friend.userId)}
                      >
                        <UserPlus className="h-4 w-4" />
                        追加
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {friends.length > 0 && addableFriends.length === 0 && (
              <div className="border-b py-4">
                <p className="text-center text-sm text-muted-foreground">{MSG.MEMBER_ALL_ADDED}</p>
              </div>
            )}

            {/* Group add */}
            {groups.length > 0 && (
              <div className="border-b pb-4">
                <p className="pt-4 pb-2 text-sm font-medium text-muted-foreground">
                  グループから追加
                </p>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-sm"
                  onClick={() => setGroupPickerOpen(true)}
                >
                  <span>
                    {selectedGroupId
                      ? groups.find((g) => g.id === selectedGroupId)?.name
                      : "グループを選択"}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
                {selectedGroupId && addableGroupMembers.length > 0 && (
                  <div className="mt-2">
                    <div className="divide-y divide-border">
                      {addableGroupMembers.map((gm) => (
                        <div key={gm.userId} className="flex items-center gap-3 py-2">
                          <UserAvatar
                            name={gm.name}
                            image={gm.image}
                            className="h-8 w-8 shrink-0"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{gm.name}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      disabled={adding}
                      onClick={handleAddGroupMembers}
                    >
                      {adding ? "追加中..." : `${addableGroupMembers.length}人を全員追加`}
                    </Button>
                  </div>
                )}
                {selectedGroupId && addableGroupMembers.length === 0 && groupMembers.length > 0 && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {MSG.MEMBER_ALL_ADDED}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Member list */}
        <div>
          <p className="px-4 pt-4 pb-2 text-sm font-medium text-muted-foreground">
            メンバー ({members.length})
          </p>
          {membersLoading ? (
            <SkeletonGroup className="px-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <SkeletonBone className="h-10 w-10 rounded-full" />
                  <SkeletonBone className="h-4 w-28" />
                  <SkeletonBone className="ml-auto h-5 w-14 rounded-full" />
                </div>
              ))}
            </SkeletonGroup>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 px-4 py-3">
                  <UserAvatar
                    name={member.name}
                    image={member.image}
                    className="h-10 w-10 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.name}</span>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${member.role === "owner" ? "" : (ROLE_COLORS[member.role as keyof typeof ROLE_COLORS] ?? "")}`}
                  >
                    {ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? member.role}
                  </Badge>
                  {isOwner && member.role !== "owner" && (
                    <ItemMenuButton
                      ariaLabel={`${member.name}のメニュー`}
                      onClick={() => setSheetMember(member)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Group picker */}
      <ActionSheet
        open={groupPickerOpen}
        onOpenChange={setGroupPickerOpen}
        actions={groups.map((g) => ({
          label: `${g.name} (${g.memberCount}人)`,
          icon: <Users className="h-4 w-4" />,
          onClick: () => setSelectedGroupId(g.id),
        }))}
      />

      {/* Member action sheet */}
      <ActionSheet
        open={sheetMember !== null && sheetActions.length > 0}
        onOpenChange={(v) => !v && setSheetMember(null)}
        actions={sheetActions}
      />

      {/* Role change sheet */}
      {roleChangeMember && (
        <ActionSheet
          open={roleChangeMember !== null}
          onOpenChange={(v) => !v && setRoleChangeMember(null)}
          actions={[
            {
              label: "編集者に変更",
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => handleRoleChange(roleChangeMember.userId, "editor"),
            },
            {
              label: "閲覧者に変更",
              icon: <Pencil className="h-4 w-4" />,
              onClick: () => handleRoleChange(roleChangeMember.userId, "viewer"),
            },
          ]}
        />
      )}

      {/* Remove confirmation */}
      <ResponsiveAlertDialog
        open={removeMember !== null}
        onOpenChange={(v) => !v && setRemoveMember(null)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>メンバーを削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              「{removeMember?.name}」を旅行から削除します。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              キャンセル
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => {
                if (removeMember) handleRemove(removeMember.userId);
                setRemoveMember(null);
              }}
            >
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
}
