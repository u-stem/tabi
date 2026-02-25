// One-time initialization script for databases managed via db:push.
// Creates drizzle.__drizzle_migrations and marks existing migrations (0000-N) as
// already applied, so that future db:migrate runs only execute new migrations.
//
// Usage:
//   bun run db:init-migration-tracking
//   MIGRATION_URL=<production_url> bun run db:init-migration-tracking

import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const url =
  process.env.MIGRATION_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
const sql = postgres(url, { ssl: isLocalhost ? false : "require", max: 1 });

const migrationsDir = join(import.meta.dir, "../../drizzle");
const journal = JSON.parse(
  readFileSync(join(migrationsDir, "meta/_journal.json"), "utf-8"),
) as { entries: { idx: number; tag: string; when: number }[] };

async function main() {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id        SERIAL PRIMARY KEY,
      hash      text   NOT NULL,
      created_at bigint
    )
  `;

  let skipped = 0;
  let recorded = 0;

  for (const entry of journal.entries) {
    const filePath = join(migrationsDir, `${entry.tag}.sql`);
    const content = readFileSync(filePath, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");

    const existing =
      await sql`SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`;
    if (existing.length > 0) {
      console.log(`skip  ${entry.tag}`);
      skipped++;
      continue;
    }

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`done  ${entry.tag}`);
    recorded++;
  }

  console.log(`\nRecorded: ${recorded}, Skipped: ${skipped}`);
  console.log("Migration tracking initialized. Run db:migrate for future changes.");

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
