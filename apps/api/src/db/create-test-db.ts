// One-off script to create the sugara_test database for integration tests.
// Run with: bun run apps/api/src/db/create-test-db.ts
import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@127.0.0.1:55322/postgres", { max: 1 });

try {
  await sql`CREATE DATABASE sugara_test OWNER postgres`;
  console.log("sugara_test database created successfully.");
} catch (e: unknown) {
  if (e instanceof Error && e.message.includes("already exists")) {
    console.log("sugara_test already exists, skipping.");
  } else {
    console.error("Error:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
} finally {
  await sql.end();
}
