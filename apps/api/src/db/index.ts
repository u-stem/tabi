import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../lib/env";
import * as schema from "./schema";

const connectionString = env.DATABASE_URL;

// Supabase requires SSL for external connections (non-localhost)
const isLocalhost =
  connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
const client = postgres(connectionString, {
  ssl: isLocalhost ? false : "require",
  max: isLocalhost ? 10 : 1,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});
export const db = drizzle(client, { schema });
