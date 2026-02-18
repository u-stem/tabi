"use client";

import type { GroupResponse } from "@sugara/shared";
import { GROUP_NAME_MAX_LENGTH } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) setName("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>グループを作成</DialogTitle>
          <DialogDescription>
            グループを作成して、旅行にメンバーを一括追加できます
          </DialogDescription>
        </DialogHeader>
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
          <DialogFooter>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? "作成中..." : "作成"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
