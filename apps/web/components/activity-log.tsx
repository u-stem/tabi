"use client";

import { type ActivityLogResponse, type MemberRole, ROLE_LABELS } from "@sugara/shared";
import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { ACTIVITY_LOG_PAGE_SIZE } from "@/lib/constants";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

type ActivityLogProps = {
  tripId: string;
  refreshKey: number;
};

type ActionStyle = {
  icon: LucideIcon;
  color: string;
};

const ACTION_STYLES: Record<string, ActionStyle> = {
  created: {
    icon: Plus,
    color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  },
  updated: { icon: Pencil, color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400" },
  deleted: { icon: Trash2, color: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400" },
  duplicated: {
    icon: Copy,
    color: "bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-400",
  },
  assigned: {
    icon: ArrowRightLeft,
    color: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400",
  },
  unassigned: {
    icon: ArrowRightLeft,
    color: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400",
  },
  role_changed: {
    icon: Pencil,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  },
};

const DEFAULT_STYLE: ActionStyle = {
  icon: Pencil,
  color: "bg-muted text-muted-foreground",
};

// Action verb templates: {name} is replaced with styled entity name
const ACTION_TEMPLATES: Record<string, Record<string, string>> = {
  trip: {
    created: "旅行{name}を作成",
    updated: "旅行{name}を更新",
    duplicated: "旅行{name}を複製",
  },
  schedule: {
    created: "予定{name}を追加",
    updated: "予定{name}を更新",
    deleted: "予定{name}を削除",
    duplicated: "予定{name}を複製",
    unassigned: "予定{name}を候補に戻す",
  },
  candidate: {
    created: "候補{name}を追加",
    updated: "候補{name}を更新",
    deleted: "候補{name}を削除",
    duplicated: "候補{name}を複製",
    assigned: "候補{name}を予定に追加",
  },
  pattern: {
    created: "パターン{name}を追加",
    updated: "パターン{name}を更新",
    deleted: "パターン{name}を削除",
    duplicated: "パターン{name}を複製",
  },
  member: {
    created: "メンバー{name}を追加",
    deleted: "メンバー{name}を削除",
    role_changed: "{name}のロールを変更",
  },
  day_memo: {
    updated: "日程メモを更新",
  },
};

type ActionParts = {
  before: string;
  entityName: string | null;
  after: string;
  detail: string | null;
};

function translateRole(role: string): string {
  return ROLE_LABELS[role as MemberRole] ?? role;
}

function translateDetail(detail: string): string {
  // "editor → viewer" -> "編集者 → 閲覧者"
  return detail.replace(/\b(owner|editor|viewer)\b/g, (match) => translateRole(match));
}

function parseAction(log: ActivityLogResponse): ActionParts {
  const template =
    ACTION_TEMPLATES[log.entityType]?.[log.action] ?? `${log.entityType}を${log.action}`;
  const name = log.entityName ? `「${log.entityName}」` : "";
  const detail = log.detail ? `(${translateDetail(log.detail)})` : null;

  if (template.includes("{name}")) {
    const [before, after] = template.split("{name}");
    return {
      before,
      entityName: log.entityName ? name : null,
      after,
      detail,
    };
  }

  return {
    before: template,
    entityName: log.entityName ? ` ${name}` : null,
    after: "",
    detail,
  };
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "たった今";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;
  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
}

type LogsResponse = {
  items: ActivityLogResponse[];
  nextCursor: string | null;
};

export function ActivityLog({ tripId, refreshKey }: ActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const prevRefreshKey = useRef(refreshKey);

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      try {
        const params: Record<string, string> = { limit: String(ACTIVITY_LOG_PAGE_SIZE) };
        if (cursor) params.cursor = cursor;
        const data = await api<LogsResponse>(`/api/trips/${tripId}/activity-logs`, { params });
        if (cursor) {
          setLogs((prev) => [...prev, ...data.items]);
        } else {
          setLogs(data.items);
        }
        setNextCursor(data.nextCursor);
        setError(false);
      } catch {
        setError(true);
      }
    },
    [tripId],
  );

  useEffect(() => {
    setLoading(true);
    fetchLogs().finally(() => setLoading(false));
  }, [fetchLogs]);

  // Re-fetch when refreshKey changes (from onMutate)
  useEffect(() => {
    if (prevRefreshKey.current !== refreshKey) {
      prevRefreshKey.current = refreshKey;
      fetchLogs();
    }
  }, [refreshKey, fetchLogs]);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchLogs(nextCursor);
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="space-y-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3 py-2">
            <Skeleton className="mt-0.5 h-6 w-6 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 leading-6">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-4 text-center text-sm text-destructive">{MSG.ACTIVITY_LOG_FETCH_FAILED}</p>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{MSG.ACTIVITY_LOG_EMPTY}</p>
    );
  }

  return (
    <div className="space-y-0">
      {logs.map((log) => {
        const style = ACTION_STYLES[log.action] ?? DEFAULT_STYLE;
        const Icon = style.icon;
        const parts = parseAction(log);

        return (
          <div key={log.id} className="flex gap-3 py-2">
            <div
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                style.color,
              )}
            >
              <Icon className="h-3 w-3" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-6">
                <span className="font-medium">{log.userName}</span>
                <span className="ml-1 text-muted-foreground">
                  {parts.before}
                  {parts.entityName && (
                    <span className="font-medium text-foreground">{parts.entityName}</span>
                  )}
                  {parts.after}
                  {parts.detail && <span className="ml-1">{parts.detail}</span>}
                </span>
                <span className="ml-2 text-xs text-muted-foreground/60">
                  {formatRelativeTime(log.createdAt)}
                </span>
              </p>
            </div>
          </div>
        );
      })}
      {nextCursor && (
        <div className="pt-2 text-center">
          <Button variant="ghost" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                読み込み中...
              </>
            ) : (
              "さらに読み込む"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
