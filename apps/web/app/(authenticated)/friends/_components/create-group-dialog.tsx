"use client";

import type { GroupResponse } from "@sugara/shared";
import { GROUP_NAME_MAX_LENGTH } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { api, getApiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

type CreateGroupDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (groupId: string) => void;
};

export function CreateGroupDialog({ open, onOpenChange, onCreated }: CreateGroupDialogProps) {
  const tm = useTranslations("messages");
  const tf = useTranslations("friend");
  const tc = useTranslations("common");
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
      toast.success(tm("groupCreated"));
      await queryClient.invalidateQueries({ queryKey: queryKeys.groups.all });
      setName("");
      onOpenChange(false);
      onCreated?.(created.id);
    } catch (err) {
      toast.error(getApiErrorMessage(err, tm("groupCreateFailed") as string));
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
          <ResponsiveDialogTitle>{tf("createGroupTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{tf("createGroupDescription")}</ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">
                {tf("groupName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tf("groupNamePlaceholder")}
                maxLength={GROUP_NAME_MAX_LENGTH}
                required
              />
            </div>
          </div>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose asChild>
              <Button type="button" variant="outline">
                <X className="h-4 w-4" />
                {tc("cancel")}
              </Button>
            </ResponsiveDialogClose>
            <Button type="submit" disabled={creating || !name.trim()}>
              <Plus className="h-4 w-4" />
              {creating ? tf("creating") : tf("create")}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
