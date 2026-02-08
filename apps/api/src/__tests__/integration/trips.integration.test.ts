import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "./setup";

describe("Trips Integration", () => {
  let db: Awaited<ReturnType<typeof setupTestDb>>["db"];
  let client: Awaited<ReturnType<typeof setupTestDb>>["client"];

  beforeAll(async () => {
    const setup = await setupTestDb();
    db = setup.db;
    client = setup.client;
  });

  afterAll(async () => {
    if (client) {
      await teardownTestDb(client);
    }
  });

  it("placeholder - requires running PostgreSQL", () => {
    // Full integration tests require `docker compose up` first.
    // Run with: TEST_DATABASE_URL=... bun run --filter @tabi/api test
    expect(true).toBe(true);
  });
});
