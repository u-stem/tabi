"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { createIdbPersister } from "@/lib/idb-persister";
import { createQueryClient } from "@/lib/query-client";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [persistOptions] = useState(() => ({
    persister: createIdbPersister(),
    maxAge: SEVEN_DAYS,
  }));

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
