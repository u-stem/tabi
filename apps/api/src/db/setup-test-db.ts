// One-off script to set up the sugara_test database for integration tests.
// Run with: bun run apps/api/src/db/setup-test-db.ts
import postgres from "postgres";

const adminUrl = "postgresql://postgres:postgres@127.0.0.1:55322/postgres";
const sql = postgres(adminUrl, { max: 1 });

try {
  // Create sugara user if not exists
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sugara') THEN
        CREATE USER sugara WITH PASSWORD 'sugara';
      END IF;
    END $$
  `;
  console.log("User sugara ensured.");

  // Grant connect on sugara_test
  await sql`GRANT ALL PRIVILEGES ON DATABASE sugara_test TO sugara`;
  // BYPASSRLS is required for integration tests to insert into RLS-protected tables
  await sql`ALTER ROLE sugara BYPASSRLS`;
  console.log("Privileges granted to sugara on sugara_test.");
} catch (e: unknown) {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await sql.end();
}

// Now grant schema privileges within sugara_test
const testSql = postgres("postgresql://postgres:postgres@127.0.0.1:55322/sugara_test", { max: 1 });

try {
  await testSql`GRANT ALL ON SCHEMA public TO sugara`;
  await testSql`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO sugara`;
  await testSql`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO sugara`;
  await testSql`GRANT ALL ON SCHEMA drizzle TO sugara`;
  await testSql`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA drizzle TO sugara`;
  console.log("Schema privileges granted.");
} catch (e: unknown) {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await testSql.end();
}

console.log("Test DB setup complete.");
