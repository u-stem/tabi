import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Supabase requires SSL for external connections (non-localhost)
const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
const client = postgres(connectionString, {
  ssl: isLocalhost ? false : "require",
});
export const db = drizzle(client, { schema });
export type Database = typeof db;
