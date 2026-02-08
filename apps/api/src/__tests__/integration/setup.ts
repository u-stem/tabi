import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../db/schema";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || "postgresql://tabi:tabi@localhost:5432/tabi_test";

export async function setupTestDb() {
  const client = postgres(TEST_DB_URL);
  const db = drizzle(client, { schema });
  return { db, client };
}

export async function teardownTestDb(client: ReturnType<typeof postgres>) {
  await client.end();
}
