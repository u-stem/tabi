"use client";

import type { UnsettledSummary } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

type UnsettledSummarySectionProps = {
  userId: string;
  isOwnProfile: boolean;
};

export function UnsettledSummarySection({ userId, isOwnProfile }: UnsettledSummarySectionProps) {
  const { data } = useQuery({
    queryKey: queryKeys.settlement.unsettled(userId),
    queryFn: () => api<UnsettledSummary>(`/api/users/${userId}/unsettled-summary`),
    enabled: isOwnProfile,
    ...QUERY_CONFIG.stable,
  });

  if (!isOwnProfile || !data || (data.totalOwed === 0 && data.totalOwedTo === 0)) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">未精算</p>
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-red-50 p-3 text-center dark:bg-red-950">
          <p className="text-xs text-red-600 dark:text-red-400">支払い残</p>
          <p className="text-lg font-bold text-red-600 dark:text-red-400">
            {data.totalOwed > 0 ? `¥${data.totalOwed.toLocaleString()}` : "-"}
          </p>
        </div>
        <div className="flex-1 rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-950">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">受取り残</p>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {data.totalOwedTo > 0 ? `¥${data.totalOwedTo.toLocaleString()}` : "-"}
          </p>
        </div>
      </div>

      {data.trips.map((trip) => (
        <div key={trip.tripId} className="overflow-hidden rounded-lg border">
          <div className="border-b bg-muted/50 px-3 py-2 text-xs font-semibold">
            {trip.tripTitle}
          </div>
          {trip.transfers.map((t, i) => {
            const isOwed = t.fromUser.id === userId;
            return (
              <div
                key={`${t.fromUser.id}-${t.toUser.id}-${i}`}
                className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0"
              >
                <span className="flex items-center gap-1">
                  {isOwed ? "あなた" : t.fromUser.name}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {isOwed ? t.toUser.name : "あなた"}
                </span>
                <span
                  className={`font-semibold ${
                    isOwed
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  ¥{t.amount.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
