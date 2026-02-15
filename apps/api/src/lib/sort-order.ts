import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { db } from "../db/index";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type QueryExecutor = typeof db | Transaction;

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
