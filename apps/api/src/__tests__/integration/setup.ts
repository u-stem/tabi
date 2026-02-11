import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://tabi:tabi@localhost:5432/tabi_test";

let _client: ReturnType<typeof postgres> | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

export function getTestDb() {
  if (!_db) {
    _client = postgres(TEST_DB_URL);
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export async function cleanupTables() {
  const db = getTestDb();
  await db.execute(
    sql`TRUNCATE schedules, day_patterns, trip_days, trip_members, trips, verifications, accounts, sessions, users CASCADE`,
  );
}

export async function createTestUser(overrides: Partial<{ name: string; email: string }> = {}) {
  const db = getTestDb();
  const [user] = await db
    .insert(schema.users)
    .values({
      name: overrides.name ?? "Test User",
      email: overrides.email ?? `test-${crypto.randomUUID().slice(0, 8)}@example.com`,
      emailVerified: false,
    })
    .returning();
  return user;
}

export async function teardownTestDb() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}
