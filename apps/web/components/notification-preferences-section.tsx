"use client";

import { NOTIFICATION_DEFAULTS, type NotificationType } from "@sugara/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { requestPushPermission } from "../lib/hooks/use-push-subscription";
import { MSG } from "../lib/messages";
import { queryKeys } from "../lib/query-keys";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Switch } from "./ui/switch";

type Pref = { type: string; inApp: boolean; push: boolean };

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

function isCategoryOn(
  prefs: Pref[],
  types: readonly CategoryType[],
  field: "inApp" | "push",
): boolean {
  return types.every((type) => {
    const pref = prefs.find((p) => p.type === type);
    return pref ? pref[field] : NOTIFICATION_DEFAULTS[type as NotificationType][field];
  });
}

export function NotificationPreferencesSection() {
  const queryClient = useQueryClient();
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  const { data } = useQuery({
    queryKey: queryKeys.notifications.preferences(),
    queryFn: () => api<Pref[]>("/api/notification-preferences"),
  });

  const updateCategory = useMutation({
    mutationFn: ({
      types,
      field,
      value,
    }: {
      types: readonly CategoryType[];
      field: "inApp" | "push";
      value: boolean;
    }) =>
      Promise.all(
        types.map((type) =>
          api("/api/notification-preferences", {
            method: "PUT",
            body: JSON.stringify({ type, [field]: value }),
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

  async function handleEnablePush() {
    const result = await requestPushPermission();
    setPushPermission(result);
  }

  const prefs = data ?? [];

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
                <Switch
                  checked={isCategoryOn(prefs, cat.types, "inApp")}
                  onCheckedChange={(v) =>
                    updateCategory.mutate({ types: cat.types, field: "inApp", value: v })
                  }
                  aria-label={`${cat.label} アプリ内通知`}
                />
                <Switch
                  checked={isCategoryOn(prefs, cat.types, "push")}
                  onCheckedChange={(v) =>
                    updateCategory.mutate({ types: cat.types, field: "push", value: v })
                  }
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
