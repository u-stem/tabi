"use client";

import { NOTIFICATION_DEFAULTS, type NotificationType } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { requestPushPermission } from "../lib/hooks/use-push-subscription";
import { QUERY_CONFIG } from "../lib/query-config";
import { queryKeys } from "../lib/query-keys";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Switch } from "./ui/switch";

type InAppPref = { type: string; inApp: boolean };

const CATEGORY_KEYS = [
  {
    labelKey: "categoryMember" as const,
    descKey: "categoryMemberDesc" as const,
    types: ["member_added", "member_removed", "role_changed"] as const,
  },
  {
    labelKey: "categorySchedule" as const,
    descKey: "categoryScheduleDesc" as const,
    types: ["schedule_created", "schedule_updated", "schedule_deleted"] as const,
  },
  {
    labelKey: "categoryPoll" as const,
    descKey: "categoryPollDesc" as const,
    types: ["poll_started", "poll_closed"] as const,
  },
  {
    labelKey: "categoryExpense" as const,
    descKey: "categoryExpenseDesc" as const,
    types: ["expense_added"] as const,
  },
] as const;

type CategoryType = (typeof CATEGORY_KEYS)[number]["types"][number];

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
  const tm = useTranslations("messages");
  const tn = useTranslations("notification");
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
    ...QUERY_CONFIG.stable,
  });

  // Device-level: push preferences for this specific device
  const { data: pushPrefsData } = useQuery({
    queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
    queryFn: () =>
      api<Record<string, boolean>>(
        `/api/push-subscriptions/preferences?endpoint=${encodeURIComponent(deviceEndpoint ?? "")}`,
      ),
    enabled: !!deviceEndpoint && pushPermission === "granted",
    ...QUERY_CONFIG.stable,
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
    onMutate: async ({ types, value }) => {
      const key = queryKeys.notifications.preferences();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<InAppPref[]>(key);
      queryClient.setQueryData<InAppPref[]>(key, (old) =>
        old?.map((pref) =>
          types.includes(pref.type as CategoryType) ? { ...pref, inApp: value } : pref,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.notifications.preferences(), context.previous);
      }
      toast.error(tm("notificationPrefUpdateFailed"));
    },
    onSettled: () => {
      // Re-fetch to confirm server state after partial-failure recovery
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.preferences() });
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
    onMutate: async ({ types, value }) => {
      const key = queryKeys.notifications.pushPreferences(deviceEndpoint ?? "");
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Record<string, boolean>>(key);
      queryClient.setQueryData<Record<string, boolean>>(key, (old) => {
        const updated = { ...(old ?? {}) };
        for (const type of types) updated[type] = value;
        return updated;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
          context.previous,
        );
      }
      toast.error(tm("notificationPrefUpdateFailed"));
    },
    onSettled: () => {
      // Re-fetch to confirm server state after partial-failure recovery
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.pushPreferences(deviceEndpoint ?? ""),
      });
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
              {pushPermission === "denied" ? tn("pushDenied") : tn("pushPrompt")}
            </p>
            {pushPermission !== "denied" && (
              <Button size="sm" variant="outline" onClick={handleEnablePush} className="shrink-0">
                {tn("enablePush")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{tn("notificationTypes")}</CardTitle>
          <CardDescription>{tn("notificationTypesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 px-1 pb-2 text-xs text-muted-foreground">
              <span />
              <span>{tn("inApp")}</span>
              <span>{tn("push")}</span>
            </div>

            {CATEGORY_KEYS.map((cat) => {
              const label = tn(cat.labelKey);
              return (
                <div
                  key={cat.labelKey}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 rounded-lg px-1 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tn(cat.descKey)}</p>
                  </div>
                  <Switch
                    checked={isInAppCategoryOn(inAppPrefs, cat.types)}
                    disabled={inAppLoading}
                    onCheckedChange={(v) =>
                      updateInAppCategory.mutate({ types: cat.types, value: v })
                    }
                    aria-label={tn("inAppLabel", { label })}
                  />
                  <Switch
                    checked={isPushCategoryOn(pushPrefsData, cat.types)}
                    onCheckedChange={(v) =>
                      updatePushCategory.mutate({ types: cat.types, value: v })
                    }
                    disabled={!pushSwitchesEnabled}
                    aria-label={tn("pushLabel", { label })}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
