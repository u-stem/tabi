import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { QUERY_CONFIG } from "@/lib/query-config";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_CONFIG.dynamic.staleTime,
        gcTime: QUERY_CONFIG.dynamic.gcTime,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry on 401 (session expired)
          if (error instanceof ApiError && error.status === 401) return false;
          return failureCount < 3;
        },
      },
    },
  });
}
