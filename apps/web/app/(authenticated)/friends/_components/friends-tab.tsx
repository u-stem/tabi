"use client";

import type { FriendResponse } from "@sugara/shared";
import { useQueryClient } from "@tanstack/react-query";
import { UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { ActionSheet } from "@/components/action-sheet";
import { ItemMenuButton } from "@/components/item-menu-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { UserAvatar } from "@/components/user-avatar";
import { api, getApiErrorMessage } from "@/lib/api";
import { broadcastFriendsUpdate } from "@/lib/hooks/use-friends-sync";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { queryKeys } from "@/lib/query-keys";

export function FriendsTab({
  friends,
  profileHrefPrefix = "/users",
}: {
  friends: FriendResponse[];
  profileHrefPrefix?: string;
}) {
  const queryClient = useQueryClient();

  return (
    <FriendListSection
      friends={friends}
      profileHrefPrefix={profileHrefPrefix}
      onRemoved={() => queryClient.invalidateQueries({ queryKey: queryKeys.friends.list() })}
    />
  );
}

function FriendListSection({
  friends,
  profileHrefPrefix,
  onRemoved,
}: {
  friends: FriendResponse[];
  profileHrefPrefix: string;
  onRemoved: () => void;
}) {
  const tm = useTranslations("messages");
  const tf = useTranslations("friend");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const isMobile = useMobile();
  const [removingFriend, setRemovingFriend] = useState<FriendResponse | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRemove(friendId: string, friendUserId: string) {
    setLoadingId(friendId);
    const cacheKey = queryKeys.friends.list();
    queryClient.cancelQueries({ queryKey: cacheKey });
    const prev = queryClient.getQueryData<FriendResponse[]>(cacheKey);
    if (prev) {
      queryClient.setQueryData(
        cacheKey,
        prev.filter((f) => f.friendId !== friendId),
      );
    }
    toast.success(tm("friendRemoved"));

    try {
      await api(`/api/friends/${friendId}`, { method: "DELETE" });
      onRemoved();
      broadcastFriendsUpdate(friendUserId);
    } catch (err) {
      if (prev) queryClient.setQueryData(cacheKey, prev);
      toast.error(getApiErrorMessage(err, tm("friendRemoveFailed") as string));
    } finally {
      setLoadingId(null);
    }
  }

  const [sheetTarget, setSheetTarget] = useState<FriendResponse | null>(null);

  return (
    <>
      {isMobile ? (
        // Native-app-like list for mobile
        friends.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tm("emptyFriend")}</p>
        ) : (
          <div className="divide-y divide-border">
            {friends.map((friend) => (
              <div key={friend.friendId} className="flex items-center gap-3">
                <Link
                  href={`${profileHrefPrefix}/${friend.userId}`}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3"
                >
                  <UserAvatar
                    name={friend.name}
                    image={friend.image}
                    className="h-10 w-10 shrink-0"
                  />
                  <span className="truncate text-sm font-medium">{friend.name}</span>
                </Link>
                <ItemMenuButton
                  ariaLabel={tc("itemMenu", { name: friend.name })}
                  onClick={() => setSheetTarget(friend)}
                />
              </div>
            ))}
          </div>
        )
      ) : (
        <Card className="border-0 shadow-none sm:border sm:shadow-sm">
          <CardHeader>
            <CardTitle>{tf("friendList")}</CardTitle>
          </CardHeader>
          <CardContent>
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tm("emptyFriend")}</p>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {friends.map((friend) => (
                  <div key={friend.friendId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar
                        name={friend.name}
                        image={friend.image}
                        className="h-6 w-6 shrink-0"
                        fallbackClassName="text-xs"
                      />
                      <span className="text-sm truncate">{friend.name}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`${profileHrefPrefix}/${friend.userId}`}>{tf("profile")}</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loadingId === friend.friendId}
                        onClick={() => setRemovingFriend(friend)}
                      >
                        {tf("unfriend")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mobile action sheet */}
      {isMobile && (
        <ActionSheet
          open={sheetTarget !== null}
          onOpenChange={(v) => !v && setSheetTarget(null)}
          actions={[
            {
              label: tf("removeFriend"),
              icon: <UserMinus className="h-4 w-4" />,
              variant: "destructive",
              onClick: () => {
                if (sheetTarget) setRemovingFriend(sheetTarget);
                setSheetTarget(null);
              },
            },
          ]}
        />
      )}
      <ResponsiveAlertDialog
        open={removingFriend !== null}
        onOpenChange={(v) => !v && setRemovingFriend(null)}
      >
        <ResponsiveAlertDialogContent>
          <ResponsiveAlertDialogHeader>
            <ResponsiveAlertDialogTitle>{tf("removeConfirmTitle")}</ResponsiveAlertDialogTitle>
            <ResponsiveAlertDialogDescription>
              {tf("removeConfirmDescription", { name: removingFriend?.name ?? "" })}
            </ResponsiveAlertDialogDescription>
          </ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogFooter>
            <ResponsiveAlertDialogCancel>
              <X className="h-4 w-4" />
              {tc("cancel")}
            </ResponsiveAlertDialogCancel>
            <ResponsiveAlertDialogDestructiveAction
              onClick={() => {
                if (removingFriend) handleRemove(removingFriend.friendId, removingFriend.userId);
                setRemovingFriend(null);
              }}
            >
              {tf("removeConfirm")}
            </ResponsiveAlertDialogDestructiveAction>
          </ResponsiveAlertDialogFooter>
        </ResponsiveAlertDialogContent>
      </ResponsiveAlertDialog>
    </>
  );
}
