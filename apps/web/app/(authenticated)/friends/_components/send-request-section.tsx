"use client";

import type { UserProfileResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, X } from "lucide-react";
import { type RefObject, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";

function ConfirmDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const isSelf = !!currentUserId && currentUserId === userId;

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.users.profile(userId),
    queryFn: () => api<UserProfileResponse>(`/api/users/${userId}/profile`),
    enabled: open && !isSelf,
    retry: false,
  });

  const [sending, setSending] = useState(false);
  const [alreadyFriend, setAlreadyFriend] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      await api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeId: userId }),
      });
      toast.success(MSG.FRIEND_REQUEST_SENT);
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.requests() });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyFriend(true);
      }
      toast.error(
        getApiErrorMessage(err, MSG.FRIEND_REQUEST_SEND_FAILED, {
          conflict: "すでにフレンドか申請済みです",
        }),
      );
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    onOpenChange(false);
  }

  let content: React.ReactNode;
  let footer: React.ReactNode;

  if (isSelf) {
    content = (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-sm text-muted-foreground">自分自身にフレンド申請はできません</p>
      </div>
    );
    footer = (
      <ResponsiveDialogFooter className="[&>*]:flex-1">
        <Button variant="outline" onClick={handleClose}>
          <X className="h-4 w-4" />
          閉じる
        </Button>
      </ResponsiveDialogFooter>
    );
  } else if (isLoading) {
    content = (
      <div className="flex flex-col items-center gap-4 py-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
    footer = null;
  } else if (error || !profile) {
    content = (
      <div className="flex flex-col items-center gap-4 py-4">
        <p className="text-sm text-muted-foreground">ユーザーが見つかりません</p>
      </div>
    );
    footer = (
      <ResponsiveDialogFooter className="[&>*]:flex-1">
        <Button variant="outline" onClick={handleClose}>
          <X className="h-4 w-4" />
          閉じる
        </Button>
      </ResponsiveDialogFooter>
    );
  } else {
    content = (
      <div className="flex flex-col items-center gap-4 py-4">
        <UserAvatar
          name={profile.name}
          image={profile.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <h3 className="text-lg font-semibold">{profile.name}</h3>
      </div>
    );
    footer = (
      <ResponsiveDialogFooter className="[&>*]:flex-1">
        {alreadyFriend ? (
          <Button disabled>すでにフレンドか申請済みです</Button>
        ) : (
          <Button onClick={handleSend} disabled={sending} className="w-full">
            <UserPlus className="mr-1 h-4 w-4" />
            {sending ? "送信中..." : "フレンド申請を送る"}
          </Button>
        )}
      </ResponsiveDialogFooter>
    );
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-xs">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>フレンド申請</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {content}
        {footer}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export function SendRequestSection({
  inputRef,
  trailing,
}: {
  inputRef?: RefObject<HTMLInputElement | null>;
  trailing?: React.ReactNode;
}) {
  const [value, setValue] = useState("");
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef ?? fallbackRef;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) setConfirmUserId(trimmed);
  }

  function handleDialogChange(open: boolean) {
    if (!open) {
      setConfirmUserId(null);
      setValue("");
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex gap-2 p-0.5">
        <Input
          ref={resolvedRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ユーザーIDを入力"
          className="flex-1"
        />
        <Button type="submit" disabled={!value.trim()} className="shrink-0">
          <Search className="mr-1 h-4 w-4" />
          検索
        </Button>
        {trailing}
      </form>
      {confirmUserId && (
        <ConfirmDialog
          userId={confirmUserId}
          open={!!confirmUserId}
          onOpenChange={handleDialogChange}
        />
      )}
    </>
  );
}
