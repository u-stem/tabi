"use client";

import type { GroupResponse } from "@sugara/shared";
import { GROUP_NAME_MAX_LENGTH } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { CreateGroupDialog } from "./create-group-dialog";
import { GroupMembersDialog } from "./group-detail-dialog";

export function GroupsTab({ groups }: { groups: GroupResponse[] }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [membersGroupId, setMembersGroupId] = useState<string | null>(null);
  const [editGroup, setEditGroup] = useState<GroupResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteGroup, setDeleteGroup] = useState<GroupResponse | null>(null);

  const membersGroup = groups.find((g) => g.id === membersGroupId) ?? null;

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editGroup) return;
    const trimmed = editName.trim();
    if (!trimmed) return;

    const cacheKey = queryKeys.groups.list();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<GroupResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.map((g) => (g.id !== editGroup.id ? g : { ...g, name: trimmed })),
      );
    }
    toast.success(MSG.GROUP_UPDATED);
    setEditGroup(null);

    try {
      await api(`/api/groups/${editGroup.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.GROUP_UPDATE_FAILED));
    }
  }

  async function handleDelete() {
    if (!deleteGroup) return;
    const groupId = deleteGroup.id;

    const cacheKey = queryKeys.groups.list();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<GroupResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((g) => g.id !== groupId),
      );
    }
    toast.success(MSG.GROUP_DELETED);
    setDeleteGroup(null);

    try {
      await api(`/api/groups/${groupId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, MSG.GROUP_DELETE_FAILED));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>グループ</CardTitle>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            新規作成
          </Button>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">グループがありません</p>
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm truncate">{group.name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {group.memberCount}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={`${group.name}のメニュー`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setMembersGroupId(group.id)}>
                        <UserPlus className="h-4 w-4" />
                        メンバー追加
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditName(group.name);
                          setEditGroup(group);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        編集
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteGroup(group)}
                      >
                        <Trash2 className="h-4 w-4" />
                        削除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setMembersGroupId}
      />

      <GroupMembersDialog group={membersGroup} onOpenChange={() => setMembersGroupId(null)} />

      {/* Edit name dialog */}
      <Dialog open={editGroup !== null} onOpenChange={(v) => !v && setEditGroup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>グループを編集</DialogTitle>
            <DialogDescription>グループ名を変更します。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRename}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-group-name">グループ名</Label>
                <Input
                  id="edit-group-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={GROUP_NAME_MAX_LENGTH}
                  required
                />
                <p className="text-right text-xs text-muted-foreground">
                  {editName.length}/{GROUP_NAME_MAX_LENGTH}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditGroup(null)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={!editName.trim()}>
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteGroup !== null} onOpenChange={(v) => !v && setDeleteGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>グループを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteGroup?.name}」を削除します。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogDestructiveAction onClick={handleDelete}>
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
