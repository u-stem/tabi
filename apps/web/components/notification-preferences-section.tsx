"use client";

import useSWR from "swr";
import { api } from "../lib/api";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";

type Pref = { type: string; inApp: boolean; push: boolean };

const TYPE_LABELS: Record<string, string> = {
  member_added: "旅行に招待された",
  member_removed: "メンバーから削除された",
  role_changed: "ロールが変更された",
  schedule_created: "スケジュールが追加された",
  schedule_updated: "スケジュールが更新された",
  schedule_deleted: "スケジュールが削除された",
  poll_started: "日程投票が開始された",
  poll_closed: "日程投票が終了した",
  expense_added: "経費が追加された",
};

function fetcher(url: string) {
  return api<Pref[]>(url);
}

export function NotificationPreferencesSection() {
  const { data, mutate } = useSWR("/api/notification-preferences", fetcher);

  async function togglePref(type: string, field: "inApp" | "push", value: boolean) {
    await api("/api/notification-preferences", {
      method: "PUT",
      body: JSON.stringify({ type, [field]: value }),
    });
    await mutate();
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">通知設定</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2 pb-1 text-sm text-muted-foreground">
          <span />
          <span>アプリ内</span>
          <span>Push</span>
        </div>
        {data?.map((pref: Pref) => (
          <div key={pref.type} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4">
            <Label>{TYPE_LABELS[pref.type] ?? pref.type}</Label>
            <Switch
              checked={pref.inApp}
              onCheckedChange={(v) => togglePref(pref.type, "inApp", v)}
            />
            <Switch checked={pref.push} onCheckedChange={(v) => togglePref(pref.type, "push", v)} />
          </div>
        ))}
      </div>
    </section>
  );
}
