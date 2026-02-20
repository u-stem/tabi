"use client";

import type { MemberRole, TripResponse, TripStatus } from "@sugara/shared";
import { canEdit, isOwner, STATUS_LABELS } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpDown,
  Check,
  FileDown,
  Link,
  MoreHorizontal,
  Pencil,
  Printer,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const MemberDialog = dynamic(() =>
  import("@/components/member-dialog").then((mod) => mod.MemberDialog),
);

const ShareDialog = dynamic(() =>
  import("@/components/share-dialog").then((mod) => mod.ShareDialog),
);

import { ActionSheet } from "@/components/action-sheet";
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { copyToClipboard } from "@/lib/clipboard";
import { formatDateFromISO } from "@/lib/format";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

type TripActionsProps = {
  tripId: string;
  status: TripStatus;
  role: MemberRole;
  pollId?: string | null;
  onStatusChange?: () => void;
  onEdit?: () => void;
  disabled?: boolean;
  memberLimitReached?: boolean;
  compact?: boolean;
};

// "scheduling" is system-managed and should not appear in the manual status dropdown
const statuses = (Object.entries(STATUS_LABELS) as [TripStatus, string][]).filter(
  ([value]) => value !== "scheduling",
);

export function TripActions({
  tripId,
  status,
  role,
  pollId,
  onStatusChange,
  onEdit,
  disabled,
  memberLimitReached,
  compact,
}: TripActionsProps) {
  const isOwnerRole = isOwner(role);
  const canEditRole = canEdit(role);
  const queryClient = useQueryClient();
  const cacheKey = queryKeys.trips.detail(tripId);
  const router = useRouter();
  const isMobile = useIsMobile();
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareExpiresAt, setShareExpiresAt] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);

  async function handleStatusChange(newStatus: string) {
    if (newStatus === status) return;

    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<TripResponse>(cacheKey);
    if (prev) {
      queryClient.setQueryData(cacheKey, { ...prev, status: newStatus });
    }
    toast.success(MSG.TRIP_STATUS_CHANGED);
    onStatusChange?.();

    try {
      await api(`/api/trips/${tripId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(MSG.TRIP_STATUS_CHANGE_FAILED);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/api/trips/${tripId}`, { method: "DELETE" });
      toast.success(MSG.TRIP_DELETED);
      router.push("/home");
    } catch {
      toast.error(MSG.TRIP_DELETE_FAILED);
    } finally {
      setDeleting(false);
    }
  }

  type ShareResponse = { shareToken: string; shareTokenExpiresAt: string | null };

  async function handleShare() {
    setSharing(true);
    try {
      let url: string;
      if (status === "scheduling" && pollId) {
        const result = await api<ShareResponse>(`/api/polls/${pollId}/share`, {
          method: "POST",
        });
        url = `${window.location.origin}/polls/shared/${result.shareToken}`;
        setShareExpiresAt(result.shareTokenExpiresAt);
      } else {
        const result = await api<ShareResponse>(`/api/trips/${tripId}/share`, {
          method: "POST",
        });
        url = `${window.location.origin}/shared/${result.shareToken}`;
        setShareExpiresAt(result.shareTokenExpiresAt);
      }
      setShareUrl(url);
      setShareDialogOpen(true);
      try {
        await copyToClipboard(url);
        toast.success(MSG.SHARE_LINK_COPIED);
      } catch {
        // Clipboard may not be available
      }
    } catch {
      toast.error(MSG.SHARE_LINK_FAILED);
    } finally {
      setSharing(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      let result: ShareResponse;
      let url: string;
      if (status === "scheduling" && pollId) {
        result = await api<ShareResponse>(`/api/polls/${pollId}/share`, { method: "PUT" });
        url = `${window.location.origin}/polls/shared/${result.shareToken}`;
      } else {
        result = await api<ShareResponse>(`/api/trips/${tripId}/share`, { method: "PUT" });
        url = `${window.location.origin}/shared/${result.shareToken}`;
      }
      setShareExpiresAt(result.shareTokenExpiresAt);
      setShareUrl(url);
      try {
        await copyToClipboard(url);
        toast.success(MSG.SHARE_LINK_REGENERATED);
      } catch {
        toast.success(MSG.SHARE_LINK_REGENERATED_NO_COPY);
      }
    } catch {
      toast.error(MSG.SHARE_LINK_REGENERATE_FAILED);
    } finally {
      setRegenerating(false);
    }
  }

  const sheetActions = [
    ...(canEditRole && status !== "scheduling"
      ? [
          {
            label: `ステータス: ${STATUS_LABELS[status]}`,
            icon: <ArrowUpDown className="h-4 w-4" />,
            onClick: () => setStatusSheetOpen(true),
          },
        ]
      : []),
    {
      label: "メンバー",
      icon: <Users className="h-4 w-4" />,
      onClick: () => setMemberOpen(true),
    },
    ...(isOwnerRole
      ? [
          {
            label: sharing ? "生成中..." : "共有リンク",
            icon: <Link className="h-4 w-4" />,
            onClick: handleShare,
          },
        ]
      : []),
    ...(canEditRole
      ? [
          {
            label: "印刷 / PDF",
            icon: <Printer className="h-4 w-4" />,
            onClick: () => window.open(`/trips/${tripId}/print`, "_blank"),
          },
        ]
      : []),
    {
      label: "エクスポート",
      icon: <FileDown className="h-4 w-4" />,
      onClick: () => window.open(`/trips/${tripId}/export`, "_blank"),
    },
    ...(onEdit
      ? [
          {
            label: "編集",
            icon: <Pencil className="h-4 w-4" />,
            onClick: onEdit,
          },
        ]
      : []),
    ...(isOwnerRole
      ? [
          {
            label: deleting ? "削除中..." : "削除",
            icon: <Trash2 className="h-4 w-4" />,
            onClick: () => setDeleteOpen(true),
            variant: "destructive" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && (
        <>
          {canEditRole && status !== "scheduling" ? (
            <Select value={status} onValueChange={handleStatusChange} disabled={disabled}>
              <SelectTrigger className="h-8 w-[130px] text-xs" aria-label="ステータス変更">
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
          {/* Desktop inline buttons (sm+) */}
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() => setMemberOpen(true)}
            disabled={disabled}
          >
            <Users className="h-4 w-4" />
            メンバー
          </Button>
          {isOwnerRole && (
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={handleShare}
              disabled={disabled || sharing}
            >
              <Link className="h-4 w-4" />
              {sharing ? "生成中..." : "共有リンク"}
            </Button>
          )}
          {/* Share expiry + regenerate */}
          {isOwnerRole && shareUrl && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerate}
                disabled={disabled || regenerating}
                aria-label="共有リンクを再生成"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
              </Button>
              {shareExpiresAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(shareExpiresAt) < new Date()
                    ? "期限切れ"
                    : `${formatDateFromISO(shareExpiresAt)}まで`}
                </span>
              )}
            </div>
          )}
        </>
      )}
      {isMobile ? (
        <>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={disabled}
            onClick={() => setSheetOpen(true)}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">旅行メニュー</span>
          </Button>
          <ActionSheet open={sheetOpen} onOpenChange={setSheetOpen} actions={sheetActions} />
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={disabled}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">旅行メニュー</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {compact && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {STATUS_LABELS[status]}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              className={compact ? "" : "sm:hidden"}
              onClick={() => setMemberOpen(true)}
            >
              <Users />
              メンバー
            </DropdownMenuItem>
            {isOwnerRole && (
              <DropdownMenuItem
                className={compact ? "" : "sm:hidden"}
                onClick={handleShare}
                disabled={sharing}
              >
                <Link />
                {sharing ? "生成中..." : "共有リンク"}
              </DropdownMenuItem>
            )}
            {canEditRole && (
              <DropdownMenuItem asChild>
                <NextLink href={`/trips/${tripId}/print`} target="_blank">
                  <Printer />
                  印刷 / PDF
                </NextLink>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <NextLink href={`/trips/${tripId}/export`} target="_blank">
                <FileDown />
                エクスポート
              </NextLink>
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                編集
              </DropdownMenuItem>
            )}
            {isOwnerRole && (
              <DropdownMenuItem
                className="text-destructive"
                disabled={deleting}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
                {deleting ? "削除中..." : "削除"}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <MemberDialog
        tripId={tripId}
        isOwner={isOwnerRole}
        open={memberOpen}
        onOpenChange={setMemberOpen}
        memberLimitReached={memberLimitReached}
      />
      {shareUrl && (
        <ShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          shareUrl={shareUrl}
          expiresAt={shareExpiresAt}
        />
      )}
      <Drawer open={statusSheetOpen} onOpenChange={setStatusSheetOpen}>
        <DrawerContent>
          <DrawerTitle className="sr-only">ステータス変更</DrawerTitle>
          <DrawerDescription className="sr-only">ステータスを選択してください</DrawerDescription>
          <div className="flex flex-col gap-2 pb-4 pt-2">
            {statuses.map(([value, label]) => (
              <Button
                key={value}
                variant={value === status ? "default" : "outline"}
                className="h-12 w-full text-base"
                onClick={() => {
                  handleStatusChange(value);
                  setStatusSheetOpen(false);
                }}
              >
                {value === status && <Check className="mr-2 h-4 w-4" />}
                {label}
              </Button>
            ))}
            <Button
              variant="outline"
              className="mt-1 h-12 w-full text-base"
              onClick={() => setStatusSheetOpen(false)}
            >
              キャンセル
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
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
            <AlertDialogDestructiveAction onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              削除する
            </AlertDialogDestructiveAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
