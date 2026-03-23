"use client";

import type { ActivityLogResponse, LogsResponse } from "@sugara/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { ArrowRightLeft, Check, Copy, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LoadingBoundary } from "@/components/ui/loading-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { MAX_LOGS_PER_TRIP } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type ActivityLogProps = {
  tripId: string;
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
  option_added: {
    icon: Plus,
    color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  },
  option_deleted: {
    icon: Trash2,
    color: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
  },
  confirmed: {
    icon: Check,
    color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
  },
  settle: {
    icon: Check,
    color: "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400",
  },
  unsettle: {
    icon: X,
    color: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
  },
};

const DEFAULT_STYLE: ActionStyle = {
  icon: Pencil,
  color: "bg-muted text-muted-foreground",
};

// Namespace mapping for activity log templates in ja.json
// entity types map to activity.* sub-namespaces
const ACTIVITY_NAMESPACE_MAP: Record<string, string> = {
  trip: "trip",
  schedule: "schedule",
  candidate: "candidate",
  pattern: "pattern",
  member: "member",
  day_memo: "day_memo",
  day_weather: "day_weather",
  expense: "expenseLog",
  poll: "pollLog",
  chat_session: "chat_session",
  settlement: "settlementLog",
};

type ActionParts = {
  before: string;
  entityName: string | null;
  after: string;
  detail: string | null;
};

function translateDetail(detail: string, tlRole: (key: string) => string): string {
  return detail.replace(/\b(owner|editor|viewer)\b/g, (match) => tlRole(match));
}

function parseAction(
  log: ActivityLogResponse,
  ta: (key: string, params?: Record<string, string>) => string,
  tlRole: (key: string) => string,
): ActionParts {
  const ns = ACTIVITY_NAMESPACE_MAP[log.entityType];
  const key = ns ? `${ns}.${log.action}` : null;
  const name = log.entityName ?? "";
  const detail = log.detail ? `(${translateDetail(log.detail, tlRole)})` : null;

  if (key) {
    const template = ta(key, { name: "__NAME__" });
    if (template.includes("__NAME__")) {
      const [before, after] = template.split("__NAME__");
      if (log.entityName) {
        return { before, entityName: name, after, detail };
      }
      // Strip surrounding brackets when entityName is absent (e.g. "候補「」を削除" -> "候補を削除")
      const cleanBefore = before.replace(/[「\u300c]$/, "");
      const cleanAfter = after.replace(/^[」\u300d]/, "");
      return { before: cleanBefore, entityName: null, after: cleanAfter, detail };
    }
    return {
      before: template,
      entityName: log.entityName ? ` ${name}` : null,
      after: "",
      detail,
    };
  }

  return {
    before: `${log.entityType} ${log.action}`,
    entityName: log.entityName ? ` ${name}` : null,
    after: "",
    detail,
  };
}

function formatRelativeTime(
  dateStr: string,
  ta: (key: string, params?: Record<string, number>) => string,
): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return ta("justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return ta("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ta("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 30) return ta("daysAgo", { count: days });
  const months = Math.floor(days / 30);
  return ta("monthsAgo", { count: months });
}

export function ActivityLog({ tripId }: ActivityLogProps) {
  const tm = useTranslations("messages");
  const ta = useTranslations("activity");
  const tlRole = useTranslations("labels.role");
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, isError } =
    useInfiniteQuery({
      queryKey: queryKeys.trips.activityLogs(tripId),
      queryFn: ({ pageParam }) => {
        const params: Record<string, string> = { limit: String(MAX_LOGS_PER_TRIP) };
        if (pageParam) params.cursor = pageParam;
        return api<LogsResponse>(`/api/trips/${tripId}/activity-logs`, { params });
      },
      initialPageParam: "" as string,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    });

  const logs = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <LoadingBoundary
      isLoading={isLoading}
      skeleton={
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
      }
    >
      {isError ? (
        <p className="py-4 text-center text-sm text-destructive">{tm("activityLogFetchFailed")}</p>
      ) : logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{tm("activityLogEmpty")}</p>
      ) : (
        <div className="space-y-0">
          {logs.map((log) => {
            const style = ACTION_STYLES[log.action] ?? DEFAULT_STYLE;
            const Icon = style.icon;
            const parts = parseAction(
              log,
              ta as (key: string, params?: Record<string, string>) => string,
              tlRole as (key: string) => string,
            );

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
                  <p className="break-words text-sm leading-6">
                    <span translate="yes" className="font-medium">
                      {log.userName}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      {parts.before}
                      {parts.entityName && (
                        <span translate="yes" className="font-medium text-foreground">
                          {parts.entityName}
                        </span>
                      )}
                      {parts.after}
                      {parts.detail && (
                        <span translate="yes" className="ml-1">
                          {parts.detail}
                        </span>
                      )}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground/60">
                      {formatRelativeTime(
                        log.createdAt,
                        ta as (key: string, params?: Record<string, number>) => string,
                      )}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
          {hasNextPage && (
            <div className="pt-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {ta("loading")}
                  </>
                ) : (
                  ta("loadMore")
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </LoadingBoundary>
  );
}
