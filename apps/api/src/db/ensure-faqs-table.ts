import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Prefer MIGRATION_URL (direct connection) for DDL operations during build.
// Falls back to DATABASE_URL for local development.
const url =
  process.env.MIGRATION_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
const client = postgres(url, { ssl: isLocalhost ? false : "require", max: 1 });
const db = drizzle(client);

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "faqs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "question" text NOT NULL,
    "answer" text NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
  )
`);
console.log("faqs table ensured");
await client.end();
process.exit(0);
