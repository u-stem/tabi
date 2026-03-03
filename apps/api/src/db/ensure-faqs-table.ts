import { sql } from "drizzle-orm";
import { db } from "./index";

// Ensure the faqs table exists via the app's own DB connection (env.DATABASE_URL),
// which is the exact same path the seed script uses.
// This is a safety net for cases where migration tracking recorded the migration
// but the DDL was not actually executed.
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
process.exit(0);
