"use client";

import { NOTIFICATION_DEFAULTS, type NotificationType } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { requestPushPermission } from "../lib/hooks/use-push-subscription";
import { MSG } from "../lib/messages";
import { queryKeys } from "../lib/query-keys";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Switch } from "./ui/switch";

type InAppPref = { type: string; inApp: boolean };

const CATEGORIES = [
  {
    label: "メンバー",
    description: "招待・削除・ロール変更",
    types: ["member_added", "member_removed", "role_changed"] as const,
  },
  {
    label: "予定",
    description: "追加・更新・削除",
    types: ["schedule_created", "schedule_updated", "schedule_deleted"] as const,
  },
  {
    label: "日程投票",
    description: "開始・終了",
    types: ["poll_started", "poll_closed"] as const,
  },
  {
    label: "費用",
    description: "追加",
    types: ["expense_added"] as const,
  },
] as const;

type CategoryType = (typeof CATEGORIES)[number]["types"][number];

function isInAppCategoryOn(prefs: InAppPref[], types: readonly CategoryType[]): boolean {
  return types.every((type) => {
    const pref = prefs.find((p) => p.type === type);
    return pref ? pref.inApp : NOTIFICATION_DEFAULTS[type as NotificationType].inApp;
  });
}

function isPushCategoryOn(
  pushPrefs: Record<string, boolean> | undefined,
  types: readonly CategoryType[],
): boolean {
  if (!pushPrefs) {
    return types.every((type) => NOTIFICATION_DEFAULTS[type as NotificationType].push);
  }
  return types.every(
    (type) => pushPrefs[type] ?? NOTIFICATION_DEFAULTS[type as NotificationType].push,
  );
}

export function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [deviceEndpoint, setDeviceEndpoint] = useState<string | null>(null);

  // Resolve the current device's push subscription endpoint so we can load per-device prefs.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => sub && setDeviceEndpoint(sub.endpoint))
      .catch((err) => console.warn("[push] failed to resolve subscription endpoint", err));
  }, []);

  // User-level: inApp preferences only
  const { data: inAppData, isLoading: inAppLoading } = useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => api<InAppPref[]>("/api/notification-preferences"),
  });

  // Device-level: push preferences for this specific device
  const { data: pushPrefsData } = useQuery({
    queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
    queryFn: () =>
      api<Record<string, boolean>>(
        `/api/push-subscriptions/preferences?endpoint=${encodeURIComponent(deviceEndpoint ?? "")}`,
      ),
    enabled: !!deviceEndpoint && pushPermission === "granted",
  });

  const updateInAppCategory = useMutation({
    mutationFn: ({ types, value }: { types: readonly CategoryType[]; value: boolean }) =>
      Promise.all(
        types.map((type) =>
          api("/api/notification-preferences", {
            method: "PUT",
            body: JSON.stringify({ type, inApp: value }),
          }),
        ),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() }),
    onError: () => {
      // Re-fetch to reconcile UI with server state in case of partial failure
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() });
      toast.error(MSG.NOTIFICATION_PREF_UPDATE_FAILED);
    },
  });

  const updatePushCategory = useMutation({
    mutationFn: ({ types, value }: { types: readonly CategoryType[]; value: boolean }) =>
      Promise.all(
        types.map((type) =>
          api("/api/push-subscriptions/preferences", {
            method: "PUT",
            body: JSON.stringify({ endpoint: deviceEndpoint, type, enabled: value }),
          }),
        ),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
      }),
    onError: () => {
      // Re-fetch to reconcile UI with server state in case of partial failure
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
      });
      toast.error(MSG.NOTIFICATION_PREF_UPDATE_FAILED);
    },
  });

  async function handleEnablePush() {
    const result = await requestPushPermission();
    setPushPermission(result);
    // Reload the subscription endpoint after permission is granted so push prefs become active.
    if (result === "granted" && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => sub && setDeviceEndpoint(sub.endpoint))
        .catch((err) => console.warn("[push] failed to resolve subscription endpoint", err));
    }
  }

  const inAppPrefs = inAppData ?? [];
  // Push switches are only interactive when the browser has an active subscription for this device.
  const pushSwitchesEnabled = pushPermission === "granted" && !!deviceEndpoint;

  return (
    <div className="space-y-4">
      {pushPermission !== "granted" && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 pt-6">
            <p className="text-sm text-muted-foreground">
              {pushPermission === "denied"
                ? "ブラウザの設定でプッシュ通知が拒否されています"
                : "プッシュ通知を有効にすると旅行の更新をリアルタイムで受け取れます"}
            </p>
            {pushPermission !== "denied" && (
              <Button size="sm" variant="outline" onClick={handleEnablePush} className="shrink-0">
                有効にする
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>通知の種類</CardTitle>
          <CardDescription>イベントごとに通知チャンネルを設定します</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 px-1 pb-2 text-xs text-muted-foreground">
              <span />
              <span>アプリ内</span>
              <span>Push</span>
            </div>

            {CATEGORIES.map((cat) => (
              <div
                key={cat.label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 rounded-lg px-1 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium leading-none">{cat.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
                </div>
                {inAppLoading ? (
                  <Skeleton className="h-5 w-9 rounded-full" />
                ) : (
                  <Switch
                    checked={isInAppCategoryOn(inAppPrefs, cat.types)}
                    onCheckedChange={(v) =>
                      updateInAppCategory.mutate({ types: cat.types, value: v })
                    }
                    aria-label={`${cat.label} アプリ内通知`}
                  />
                )}
                <Switch
                  checked={isPushCategoryOn(pushPrefsData, cat.types)}
                  onCheckedChange={(v) => updatePushCategory.mutate({ types: cat.types, value: v })}
                  disabled={!pushSwitchesEnabled}
                  aria-label={`${cat.label} プッシュ通知`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
