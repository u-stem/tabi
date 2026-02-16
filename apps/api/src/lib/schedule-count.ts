import { count, eq } from "drizzle-orm";
import type { db as dbInstance } from "../db/index";
import { schedules } from "../db/schema";

type Transaction = Parameters<Parameters<typeof dbInstance.transaction>[0]>[0];
type TxOrDb = typeof dbInstance | Transaction;

export async function getScheduleCount(dbOrTx: TxOrDb, tripId: string): Promise<number> {
  const [result] = await dbOrTx
    .select({ count: count() })
    .from(schedules)
    .where(eq(schedules.tripId, tripId));
  return result.count;
}
