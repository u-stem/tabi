/**
 * One-time fix: register migration 0017 in drizzle.__drizzle_migrations.
 *
 * Migration 0017 (0017_per_device_push_prefs.sql) was applied to production
 * outside of drizzle-kit migrate (via db:push), so the tracking table has no
 * record of it. drizzle-kit migrate then tries to run it again and fails with
 * "column already exists". This script inserts the missing record so subsequent
 * migrations (0018+) can be applied normally.
 *
 * Usage:
 *   MIGRATION_URL=<production-transaction-pooler-url> bun run apps/api/src/scripts/fix-0017-migration-tracking.ts
 */

import postgres from "postgres";

const MIGRATION_URL = process.env.MIGRATION_URL;
if (!MIGRATION_URL) {
  console.error("MIGRATION_URL is required");
  process.exit(1);
}

// Values from drizzle/meta/_journal.json (idx=17) and sha256 of the SQL file
const MIGRATION_HASH =
  "d75ce9c1e946bf044f009c68d0bf64527a2c8ebdfca09f32092b880069d70d8b";
const MIGRATION_CREATED_AT = 1772755200000; // journal `when`

const isLocalhost =
  MIGRATION_URL.includes("localhost") || MIGRATION_URL.includes("127.0.0.1");
const sql = postgres(MIGRATION_URL, {
  ssl: isLocalhost ? false : "require",
  max: 1,
});

try {
  // Check if the record already exists
  const existing = await sql`
    SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${MIGRATION_HASH}
  `;

  if (existing.length > 0) {
    console.log(
      "Migration 0017 is already tracked (id=%d). Nothing to do.",
      existing[0].id,
    );
    process.exit(0);
  }

  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${MIGRATION_HASH}, ${MIGRATION_CREATED_AT})
  `;

  console.log("Inserted migration 0017 into drizzle.__drizzle_migrations.");
  console.log(
    "You can now run: MIGRATION_URL=<url> bun run db:migrate  (to apply 0018+)",
  );
} finally {
  await sql.end();
}
