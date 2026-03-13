import type { UnsettledSummary } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { QUERY_CONFIG } from "@/lib/query-config";
import { queryKeys } from "@/lib/query-keys";

export function useUnsettledTripIds(): Set<string> {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const { data } = useQuery({
    queryKey: queryKeys.settlement.unsettled(userId ?? ""),
    queryFn: () => api<UnsettledSummary>(`/api/users/${userId}/unsettled-summary`),
    enabled: !!userId,
    ...QUERY_CONFIG.stable,
  });

  return useMemo(() => new Set(data?.trips.map((t) => t.tripId) ?? []), [data]);
}
