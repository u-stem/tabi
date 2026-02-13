import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

// Simplified type to work with both db and transaction contexts
// biome-ignore lint/suspicious/noExplicitAny: Drizzle's type system makes it impractical to type this precisely
type QueryExecutor = any;

export async function getNextSortOrder(
  dbOrTx: QueryExecutor,
  column: PgColumn,
  table: PgTable,
  condition: SQL | undefined,
): Promise<number> {
  const [result] = await dbOrTx
    .select({ max: sql<number>`COALESCE(MAX(${column}), -1)` })
    .from(table)
    .where(condition);
  return result.max + 1;
}
