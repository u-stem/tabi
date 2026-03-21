"use client";

import type { GroupResponse } from "@sugara/shared";
import { GROUP_NAME_MAX_LENGTH } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Check, MoreHorizontal, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { Fab } from "@/components/fab";
import { ItemMenuButton } from "@/components/item-menu-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { api, getApiErrorMessage } from "@/lib/api";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { queryKeys } from "@/lib/query-keys";
import { CreateGroupDialog } from "./create-group-dialog";
import { GroupDetailModal } from "./group-detail-modal";

export function GroupsTab({
  groups,
  createOpen: externalCreateOpen,
  onCreateOpenChange,
}: {
  groups: GroupResponse[];
  createOpen?: boolean;
  onCreateOpenChange?: (v: boolean) => void;
}) {
  const tm = useTranslations("messages");
  const tf = useTranslations("friend");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const isMobile = useMobile();
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const createOpen = externalCreateOpen ?? internalCreateOpen;
  const setCreateOpen = onCreateOpenChange ?? setInternalCreateOpen;
  const [detailGroup, setDetailGroup] = useState<GroupResponse | null>(null);
  const [editGroup, setEditGroup] = useState<GroupResponse | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteGroup, setDeleteGroup] = useState<GroupResponse | null>(null);
  const [sheetGroup, setSheetGroup] = useState<GroupResponse | null>(null);

  const sheetActions = sheetGroup
    ? [
        {
          label: tc("edit"),
          icon: <Pencil className="h-4 w-4" />,
          onClick: () => {
            setEditName(sheetGroup.name);
            setEditGroup(sheetGroup);
          },
        },
        {
          label: tc("delete"),
          icon: <Trash2 className="h-4 w-4" />,
          onClick: () => setDeleteGroup(sheetGroup),
          variant: "destructive" as const,
        },
      ]
    : [];

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
    toast.success(tm("groupUpdated"));
    setEditGroup(null);

    try {
      await api(`/api/groups/${editGroup.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.list() });
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, tm("groupUpdateFailed") as string));
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
    toast.success(tm("groupDeleted"));
    setDeleteGroup(null);

    try {
      await api(`/api/groups/${groupId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, tm("groupDeleteFailed") as string));
    }
  }

  return (
    <div className="space-y-4">
      {isMobile ? (
        groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tm("emptyGroup")}</p>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                  onClick={() => setDetailGroup(group)}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span translate="yes" className="block truncate text-sm font-medium">
                      {group.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {tf("memberCount", { count: group.memberCount })}
                    </span>
                  </div>
                </button>
                <ItemMenuButton
                  ariaLabel={tc("itemMenu", { name: group.name })}
                  onClick={() => setSheetGroup(group)}
                />
              </div>
            ))}
          </div>
        )
      ) : (
        <Card className="border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{tf("groupTitle")}</CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {tf("createGroup")}
              <span className="hidden text-xs text-muted-foreground lg:inline">(N)</span>
            </Button>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tm("emptyGroup")}</p>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="flex items-center gap-2 min-w-0 hover:underline"
                      onClick={() => setDetailGroup(group)}
                    >
                      <span translate="yes" className="text-sm truncate">
                        {group.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {group.memberCount}
                      </span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          aria-label={tc("itemMenu", { name: group.name })}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetailGroup(group)}>
                          <Users className="h-4 w-4" />
                          {tf("memberManagement")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setEditName(group.name);
                            setEditGroup(group);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          {tc("edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteGroup(group)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {tc("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />

      <GroupDetailModal group={detailGroup} onOpenChange={(v) => !v && setDetailGroup(null)} />

      {/* Edit name dialog */}
      <ResponsiveDialog open={editGroup !== null} onOpenChange={(v) => !v && setEditGroup(null)}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{tf("editGroupTitle")}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>{tf("editGroupDescription")}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <form onSubmit={handleRename}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-group-name">
                  {tf("groupName")} <span className="text-destructive">*</span>
                </Label>
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
            <ResponsiveDialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditGroup(null)}>
                <X className="h-4 w-4" />
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={!editName.trim()}>
                <Check className="h-4 w-4" />
                {tc("save")}
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Delete confirmation */}
      <ResponsiveAlertDialog
        open={deleteGroup !== null}
        onOpenChange={(v) => !v && setDeleteGroup(null)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>{tf("deleteGroupTitle")}</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              {tf("deleteGroupDescription", { name: deleteGroup?.name ?? "" })}
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              {tc("cancel")}
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction onClick={handleDelete}>
              {tc("deletConfirm")}
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>

      <ActionSheet
        open={sheetGroup !== null}
        onOpenChange={(open) => !open && setSheetGroup(null)}
        actions={sheetActions}
      />

      {/* Only show internal FAB when page doesn't control the state externally */}
      {!onCreateOpenChange && (
        <Fab onClick={() => setCreateOpen(true)} label={tf("createGroupFab")} hidden={!isMobile} />
      )}
    </div>
  );
}
