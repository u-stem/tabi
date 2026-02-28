"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

const SUPABASE_MAU_LIMIT = 50_000;
const SUPABASE_DB_SIZE_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB

type AdminStatsResponse = {
  users: {
    total: number;
    guest: number;
    newLast7Days: number;
    newLast30Days: number;
  };
  trips: {
    total: number;
    byStatus: {
      scheduling: number;
      draft: number;
      planned: number;
      active: number;
      completed: number;
    };
    newLast7Days: number;
  };
  content: {
    schedules: number;
    souvenirs: number;
  };
  supabase: {
    mau: number;
    dbSizeBytes: number;
  };
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function UsageBar({
  label,
  value,
  limit,
  formatValue,
}: {
  label: string;
  value: number;
  limit: number;
  formatValue: (v: number) => string;
}) {
  const pct = Math.min((value / limit) * 100, 100);
  const color = pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatValue(value)} / {formatValue(limit)}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-right text-xs text-muted-foreground">{pct.toFixed(1)}%</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

type AdminSettingsResponse = { signupEnabled: boolean };

export default function AdminPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: () => api<AdminStatsResponse>("/api/admin/stats"),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.status === 403 || err.status === 401)) return false;
      return failureCount < 3;
    },
  });

  const { data: settings } = useQuery({
    queryKey: queryKeys.admin.settings(),
    queryFn: () => api<AdminSettingsResponse>("/api/admin/settings"),
    staleTime: 30 * 1000,
  });

  const toggleSignup = useMutation({
    mutationFn: (signupEnabled: boolean) =>
      api<AdminSettingsResponse>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ signupEnabled }),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.admin.settings(), updated);
      toast.success(
        updated.signupEnabled ? "新規利用受付を再開しました" : "新規利用受付を停止しました",
      );
    },
    onError: () => {
      toast.error("設定の変更に失敗しました");
    },
  });

  const updatedAt = dataUpdatedAt > 0 ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container flex h-14 items-center gap-3">
          <Logo />
          <span className="text-sm font-medium text-muted-foreground">管理ダッシュボード</span>
          {updatedAt && (
            <span className="ml-auto text-xs text-muted-foreground">最終更新: {updatedAt}</span>
          )}
        </div>
      </header>

      <main className="container max-w-4xl space-y-8 py-8">
        {isLoading && <p className="text-center text-sm text-muted-foreground">読み込み中...</p>}

        {error &&
          !(error instanceof ApiError && (error.status === 403 || error.status === 401)) && (
            <p className="text-center text-sm text-destructive">
              エラー: {error instanceof Error ? error.message : "不明なエラー"}
            </p>
          )}

        {settings !== undefined && (
          <Section title="設定">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">新規利用受付</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {settings.signupEnabled
                      ? "新規アカウントの作成を受け付けています"
                      : "新規アカウントの作成を停止しています"}
                  </p>
                </div>
                <Switch
                  checked={settings.signupEnabled}
                  disabled={toggleSignup.isPending}
                  onCheckedChange={(checked) => toggleSignup.mutate(checked)}
                />
              </div>
            </div>
          </Section>
        )}

        {data && (
          <>
            <Section title="ユーザー">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="総ユーザー" value={data.users.total} />
                <StatCard label="ゲスト" value={data.users.guest} />
                <StatCard label="7日以内 新規" value={data.users.newLast7Days} />
                <StatCard label="30日以内 新規" value={data.users.newLast30Days} />
              </div>
            </Section>

            <Section title="旅行">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="総数" value={data.trips.total} />
                <StatCard label="日程調整" value={data.trips.byStatus.scheduling} />
                <StatCard label="下書き" value={data.trips.byStatus.draft} />
                <StatCard label="計画済" value={data.trips.byStatus.planned} />
                <StatCard label="旅行中" value={data.trips.byStatus.active} />
                <StatCard label="完了" value={data.trips.byStatus.completed} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                7日以内作成: {data.trips.newLast7Days.toLocaleString()}件
              </p>
            </Section>

            <Section title="コンテンツ">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="スポット" value={data.content.schedules} />
                <StatCard label="お土産" value={data.content.souvenirs} />
              </div>
            </Section>

            <Section title="Supabase 無料プラン使用状況">
              <div className="rounded-lg border bg-card space-y-4 p-5">
                <UsageBar
                  label="MAU（月間アクティブユーザー）"
                  value={data.supabase.mau}
                  limit={SUPABASE_MAU_LIMIT}
                  formatValue={(v) => v.toLocaleString()}
                />
                <UsageBar
                  label="DB サイズ"
                  value={data.supabase.dbSizeBytes}
                  limit={SUPABASE_DB_SIZE_LIMIT_BYTES}
                  formatValue={(v) => `${(v / 1024 / 1024).toFixed(1)} MB`}
                />
              </div>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
