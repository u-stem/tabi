"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { STATUS_LABELS } from "@tabi/shared";

type TripActionsProps = {
  tripId: string;
  status: string;
};

export function TripActions({ tripId, status }: TripActionsProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/api/trips/${tripId}`, { method: "DELETE" });
      toast.success("旅行を削除しました");
      router.push("/dashboard");
    } catch {
      toast.error("旅行の削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const result = await api<{ shareToken: string }>(
        `/api/trips/${tripId}/share`,
        { method: "POST" },
      );
      const shareUrl = `${window.location.origin}/shared/${result.shareToken}`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("共有リンクをコピーしました");
    } catch {
      toast.error("共有リンクの生成に失敗しました");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}
        </Badge>
        <Button variant="outline" size="sm" onClick={handleShare} disabled={sharing}>
          {sharing ? "生成中..." : "共有リンク"}
        </Button>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={deleting} className="text-muted-foreground hover:text-destructive">
            {deleting ? "削除中..." : "削除"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>旅行を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この旅行とすべてのスポットが削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>削除する</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
