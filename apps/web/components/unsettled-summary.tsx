"use client";

import type { UnsettledSummary } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

type UnsettledSummarySectionProps = {
  userId: string;
  isOwnProfile: boolean;
};

export function UnsettledSummarySection({ userId, isOwnProfile }: UnsettledSummarySectionProps) {
  const pathname = usePathname();
  const { data } = useQuery({
    queryKey: queryKeys.settlement.unsettled(userId),
    queryFn: () => api<UnsettledSummary>(`/api/users/${userId}/unsettled-summary`),
    enabled: isOwnProfile,
    ...QUERY_CONFIG.stable,
  });

  if (!isOwnProfile || !data || (data.totalOwed === 0 && data.totalOwedTo === 0)) {
    return null;
  }

  const tripBase = pathname.startsWith("/sp/") ? "/sp/trips" : "/trips";

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">未精算</h2>
      {data.trips.map((trip) => {
        const owed = trip.transfers
          .filter((t) => t.fromUser.id === userId)
          .reduce((sum, t) => sum + t.amount, 0);
        const owedTo = trip.transfers
          .filter((t) => t.toUser.id === userId)
          .reduce((sum, t) => sum + t.amount, 0);

        return (
          <Link
            key={trip.tripId}
            href={`${tripBase}/${trip.tripId}`}
            className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm hover:bg-accent transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{trip.tripTitle}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {trip.transfers.map((t) => (
                  <span
                    key={`${t.fromUser.id}-${t.toUser.id}-${t.amount}`}
                    className="flex items-center gap-0.5"
                  >
                    {t.fromUser.name}
                    <ArrowRight className="h-2.5 w-2.5" />
                    {t.toUser.name}
                  </span>
                ))}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {owed > 0 && (
                <span className="font-medium text-destructive">-¥{owed.toLocaleString()}</span>
              )}
              {owedTo > 0 && (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  +¥{owedTo.toLocaleString()}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
