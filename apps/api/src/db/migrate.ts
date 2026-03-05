import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.MIGRATION_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const isLocalhost = url.includes("localhost") || url.includes("127.0.0.1");
const client = postgres(url, {
  ssl: isLocalhost ? false : "require",
  max: 1,
});

const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied successfully");
} catch (error) {
  console.error("Migration failed:", error);
  process.exit(1);
} finally {
  await client.end();
}
