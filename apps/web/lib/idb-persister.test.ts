import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock("idb-keyval", () => ({
  get: (...args: unknown[]) => mockGet(...args),
  set: (...args: unknown[]) => mockSet(...args),
  del: (...args: unknown[]) => mockDel(...args),
}));

import { createIdbPersister } from "./idb-persister";

describe("createIdbPersister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("persistClient", () => {
    it("saves dehydrated state to IndexedDB", async () => {
      mockSet.mockResolvedValueOnce(undefined);
      const persister = createIdbPersister();
      const dehydratedState = { queries: [], mutations: [] };

      await persister.persistClient(dehydratedState as never);

      expect(mockSet).toHaveBeenCalledWith("sugara-query-cache", dehydratedState);
    });

    it("does not throw when IndexedDB write fails", async () => {
      mockSet.mockRejectedValueOnce(new Error("QuotaExceeded"));
      const persister = createIdbPersister();

      await expect(
        persister.persistClient({ queries: [], mutations: [] } as never),
      ).resolves.not.toThrow();
    });
  });

  describe("restoreClient", () => {
    it("restores dehydrated state from IndexedDB", async () => {
      const dehydratedState = { queries: [], mutations: [] };
      mockGet.mockResolvedValueOnce(dehydratedState);
      const persister = createIdbPersister();

      const result = await persister.restoreClient();

      expect(result).toEqual(dehydratedState);
    });

    it("returns undefined when no cache exists", async () => {
      mockGet.mockResolvedValueOnce(undefined);
      const persister = createIdbPersister();

      const result = await persister.restoreClient();

      expect(result).toBeUndefined();
    });

    it("returns undefined when IndexedDB read fails", async () => {
      mockGet.mockRejectedValueOnce(new Error("NotFound"));
      const persister = createIdbPersister();

      const result = await persister.restoreClient();

      expect(result).toBeUndefined();
    });
  });

  describe("removeClient", () => {
    it("deletes cache from IndexedDB", async () => {
      mockDel.mockResolvedValueOnce(undefined);
      const persister = createIdbPersister();

      await persister.removeClient();

      expect(mockDel).toHaveBeenCalledWith("sugara-query-cache");
    });

    it("does not throw when IndexedDB delete fails", async () => {
      mockDel.mockRejectedValueOnce(new Error("NotFound"));
      const persister = createIdbPersister();

      await expect(persister.removeClient()).resolves.not.toThrow();
    });
  });
});
