"use client";

import {
  BOOKMARK_LIST_NAME_MAX_LENGTH,
  type BookmarkListResponse,
  type BookmarkListVisibility,
} from "@sugara/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, getApiErrorMessage } from "@/lib/api";
import { MSG } from "@/lib/messages";

type CreateBookmarkListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

export function CreateBookmarkListDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateBookmarkListDialogProps) {
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<BookmarkListVisibility>("private");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(isOpen: boolean) {
    onOpenChange(isOpen);
    if (!isOpen) {
      setName("");
      setVisibility("private");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await api<BookmarkListResponse>("/api/bookmark-lists", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, visibility }),
      });
      toast.success(MSG.BOOKMARK_LIST_CREATED);
      handleOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(getApiErrorMessage(err, MSG.BOOKMARK_LIST_CREATE_FAILED));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>リストを作成</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            ブックマークを整理するリストを作成します。
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-list-name">リスト名</Label>
              <Input
                id="new-list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="行きたい場所"
                maxLength={BOOKMARK_LIST_NAME_MAX_LENGTH}
                required
                autoFocus
              />
              <p className="text-right text-xs text-muted-foreground">
                {name.length}/{BOOKMARK_LIST_NAME_MAX_LENGTH}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-list-visibility">公開設定</Label>
              <Select
                value={visibility}
                onValueChange={(v) => setVisibility(v as BookmarkListVisibility)}
              >
                <SelectTrigger id="new-list-visibility" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">非公開</SelectItem>
                  <SelectItem value="friends_only">フレンド限定</SelectItem>
                  <SelectItem value="public">全体公開</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ResponsiveDialogFooter>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "作成中..." : "作成"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
