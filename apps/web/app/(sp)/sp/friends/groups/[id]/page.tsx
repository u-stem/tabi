"use client";

import type { GroupMemberResponse, GroupResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { Fab } from "@/components/fab";
import { ItemMenuButton } from "@/components/item-menu-button";
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
import { pageTitle } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export default function SpGroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [removingMember, setRemovingMember] = useState<GroupMemberResponse | null>(null);
  const [sheetMember, setSheetMember] = useState<GroupMemberResponse | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: queryKeys.groups.list(),
    queryFn: () => api<GroupResponse[]>("/api/groups"),
    ...QUERY_CONFIG.stable,
  });
  const group = groups.find((g) => g.id === groupId);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: queryKeys.groups.members(groupId),
    queryFn: () => api<GroupMemberResponse[]>(`/api/groups/${groupId}/members`),
    ...QUERY_CONFIG.stable,
  });

  useEffect(() => {
    document.title = pageTitle(group?.name ?? "グループ");
  }, [group?.name]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.members(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
  };

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

  return (
    <>
      {/* Nav bar */}
      <div className="relative mt-2 flex h-10 items-center px-4">
        <Link
          href="/sp/friends"
          className="z-10 inline-flex items-center gap-0.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Link>
        <span className="absolute inset-x-16 truncate text-center text-sm font-semibold">
          {group?.name ?? "グループ"}
        </span>
      </div>

      {/* Member list */}
      {membersLoading ? (
        <SkeletonGroup className="mt-3 px-4">
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
        <div className="mt-3 divide-y divide-border">
          {members.map((member) => (
            <div key={member.userId} className="flex items-center gap-3 px-4">
              <Link
                href={`/sp/users/${member.userId}`}
                className="flex min-w-0 flex-1 items-center gap-3 py-3"
              >
                <UserAvatar
                  name={member.name}
                  image={member.image}
                  className="h-10 w-10 shrink-0"
                />
                <span className="truncate text-sm font-medium">{member.name}</span>
              </Link>
              <ItemMenuButton
                ariaLabel={`${member.name}のメニュー`}
                onClick={() => setSheetMember(member)}
              />
            </div>
          ))}
        </div>
      )}

      {/* FAB → add page */}
      <Fab
        onClick={() => router.push(`/sp/friends/groups/${groupId}/add`)}
        label="メンバーを追加"
      />

      {/* Member action sheet */}
      <ActionSheet
        open={sheetMember !== null}
        onOpenChange={(v) => !v && setSheetMember(null)}
        actions={[
          {
            label: "メンバーを削除",
            icon: <UserMinus className="h-4 w-4" />,
            variant: "destructive",
            onClick: () => {
              if (sheetMember) setRemovingMember(sheetMember);
              setSheetMember(null);
            },
          },
        ]}
      />

      {/* Remove confirmation */}
      <ResponsiveAlertDialog
        open={removingMember !== null}
        onOpenChange={(v) => !v && setRemovingMember(null)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>メンバーを削除しますか？</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              「{removingMember?.name}」をグループから削除します。この操作は取り消せません。
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              キャンセル
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction onClick={handleRemoveMember}>
              削除する
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
}
