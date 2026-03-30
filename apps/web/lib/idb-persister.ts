import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";

const CACHE_KEY = "sugara-query-cache";

export function createIdbPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(CACHE_KEY, client);
      } catch {
        // Quota exceeded or private browsing — silently skip
      }
    },

    restoreClient: async () => {
      try {
        return await get<PersistedClient>(CACHE_KEY);
      } catch {
        return undefined;
      }
    },

    removeClient: async () => {
      try {
        await del(CACHE_KEY);
      } catch {
        // Already gone or private browsing — ignore
      }
    },
  };
}
