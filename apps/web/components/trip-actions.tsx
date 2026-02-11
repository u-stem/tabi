"use client";

import type { MemberRole, TripStatus } from "@sugara/shared";
import { STATUS_LABELS } from "@sugara/shared";
import { Link, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MemberDialog } from "@/components/member-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

type TripActionsProps = {
  tripId: string;
  status: TripStatus;
  role: MemberRole;
  onStatusChange?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
};

const statuses = Object.entries(STATUS_LABELS) as [TripStatus, string][];

export function TripActions({
  tripId,
  status,
  role,
  onStatusChange,
  onEdit,
  disabled,
}: TripActionsProps) {
  const isOwnerRole = role === "owner";
  const canEditRole = role === "owner" || role === "editor";
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === status) return;
    try {
      await api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success("ステータスを変更しました");
      onStatusChange?.();
    } catch {
      toast.error("ステータスの変更に失敗しました");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/api/trips/${tripId}`, { method: "DELETE" });
      toast.success("旅行を削除しました");
      router.push("/home");
    } catch {
      toast.error("旅行の削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  type ShareResponse = { shareToken: string; shareTokenExpiresAt: string | null };

  async function copyToClipboard(text: string) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const result = await api<ShareResponse>(`/api/trips/${tripId}/share`, {
        method: "POST",
      });
      const shareUrl = `${window.location.origin}/shared/${result.shareToken}`;
      await copyToClipboard(shareUrl);
      setShareExpiresAt(result.shareTokenExpiresAt);
      toast.success("共有リンクをコピーしました");
    } catch {
      toast.error("共有リンクの生成に失敗しました");
    } finally {
      setSharing(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const result = await api<ShareResponse>(`/api/trips/${tripId}/share`, {
        method: "PUT",
      });
      const shareUrl = `${window.location.origin}/shared/${result.shareToken}`;
      await copyToClipboard(shareUrl);
      setShareExpiresAt(result.shareTokenExpiresAt);
      toast.success("共有リンクを再生成してコピーしました");
    } catch {
      toast.error("共有リンクの再生成に失敗しました");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        {canEditRole ? (
          <Select value={status} onValueChange={handleStatusChange} disabled={disabled}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
        )}
        <MemberDialog tripId={tripId} isOwner={isOwnerRole} />
        {isOwnerRole && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              disabled={disabled || sharing}
            >
              <Link className="h-4 w-4" />
              {sharing ? "生成中..." : "共有リンク"}
            </Button>
            {shareExpiresAt && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={disabled || regenerating}
                  title="共有リンクを再生成"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {new Date(shareExpiresAt) < new Date()
                    ? "期限切れ"
                    : `${new Date(shareExpiresAt).toLocaleDateString("ja-JP")}まで`}
                </span>
              </>
            )}
          </div>
        )}
      </div>
      {canEditRole && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={disabled}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">旅行メニュー</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                編集
              </DropdownMenuItem>
            )}
            {isOwnerRole && (
              <DropdownMenuItem
                className="text-destructive"
                disabled={deleting}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {deleting ? "削除中..." : "削除"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>旅行を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この旅行とすべての予定が削除されます。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
