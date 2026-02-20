"use client";

import type { GroupResponse } from "@sugara/shared";
import { GROUP_NAME_MAX_LENGTH } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type CreateGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (groupId: string) => void;
};

export function CreateGroupDialog({ open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    try {
      const created = await api<GroupResponse>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      toast.success(MSG.GROUP_CREATED);
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      setName("");
      onOpenChange(false);
      onCreated?.(created.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.GROUP_CREATE_FAILED));
    } finally {
      setCreating(false);
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) setName("");
      }}
    >
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>グループを作成</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            グループを作成して、旅行にメンバーを一括追加できます
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">グループ名</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 家族、同僚"
                maxLength={GROUP_NAME_MAX_LENGTH}
                required
              />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? "作成中..." : "作成"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
