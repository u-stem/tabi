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
    <div className="rounded-lg border">
      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <span className="font-medium">未精算</span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          {data.totalOwed > 0 && (
            <span>
              支払い残{" "}
              <span className="font-semibold text-destructive">
                ¥{data.totalOwed.toLocaleString()}
              </span>
            </span>
          )}
          {data.totalOwedTo > 0 && (
            <span>
              受取り残{" "}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                ¥{data.totalOwedTo.toLocaleString()}
              </span>
            </span>
          )}
        </span>
      </div>
      {data.trips.map((trip) => (
        <div key={trip.tripId}>
          <div className="border-t bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
            {trip.tripTitle}
          </div>
          {trip.transfers.map((t, i) => {
            const isOwed = t.fromUser.id === userId;
            return (
              <div
                key={`${t.fromUser.id}-${t.toUser.id}-${i}`}
                className="flex items-center justify-between border-t px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-1">
                  {isOwed ? "あなた" : t.fromUser.name}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  {isOwed ? t.toUser.name : "あなた"}
                </span>
                <span
                  className={`font-medium ${
                    isOwed ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
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
