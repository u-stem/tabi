import { asc, eq, inArray, sql } from "drizzle-orm";
import type { db as dbInstance } from "../db/index";
import { dayPatterns, tripDays } from "../db/schema";
import { DEFAULT_PATTERN_LABEL, MAX_TRIP_DAYS } from "./constants";

type Transaction = Parameters<Parameters<typeof dbInstance.transaction>[0]>[0];
type TxOrDb = typeof dbInstance | Transaction;

export function generateDateRange(startDate: string, endDate: string): string[] {
  // Use UTC to avoid timezone-dependent date shifts
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates: string[] = [];
  for (
    let d = new Date(start);
    d <= end && dates.length < MAX_TRIP_DAYS;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${dayOfMonth}`);
  }
  return dates;
}

/**
 * Sync trip days: delete days outside new range, insert new days with default patterns,
 * re-number all days sequentially.
 */
export async function syncTripDays(
  tx: TxOrDb,
  tripId: string,
  effectiveStart: string,
  effectiveEnd: string,
) {
  const newDates = generateDateRange(effectiveStart, effectiveEnd);

  const existingDays = await tx
    .select()
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.date));

  const existingDateSet = new Set(existingDays.map((d: { date: string }) => d.date));
  const newDateSet = new Set(newDates);

  // Delete days outside new range
  const idsToDelete = existingDays
    .filter((d: { date: string }) => !newDateSet.has(d.date))
    .map((d: { id: string }) => d.id);
  if (idsToDelete.length > 0) {
    await tx.delete(tripDays).where(inArray(tripDays.id, idsToDelete));
  }

  // Insert new days with default patterns
  const datesToInsert = newDates.filter((d) => !existingDateSet.has(d));
  if (datesToInsert.length > 0) {
    const newDays = await tx
      .insert(tripDays)
      .values(
        datesToInsert.map((date) => ({
          tripId,
          date,
          dayNumber: 0,
        })),
      )
      .returning({ id: tripDays.id });

    await tx.insert(dayPatterns).values(
      newDays.map((day: { id: string }) => ({
        tripDayId: day.id,
        label: DEFAULT_PATTERN_LABEL,
        isDefault: true,
        sortOrder: 0,
      })),
    );
  }

  // Re-number all days sequentially (bulk update)
  const allDays = await tx
    .select({ id: tripDays.id, dayNumber: tripDays.dayNumber })
    .from(tripDays)
    .where(eq(tripDays.tripId, tripId))
    .orderBy(asc(tripDays.date));

  const updates = allDays
    .map((day, i) => ({ id: day.id, dayNumber: i + 1 }))
    .filter((u, i) => allDays[i].dayNumber !== u.dayNumber);

  if (updates.length > 0) {
    const ids = updates.map((u) => u.id);
    // Use SQL CASE expression for single-query bulk update
    const caseParts = updates.map((u) => sql`WHEN ${u.id} THEN ${u.dayNumber}`);
    await tx
      .update(tripDays)
      .set({
        dayNumber: sql`CASE ${tripDays.id} ${sql.join(caseParts, sql` `)} END`,
      })
      .where(inArray(tripDays.id, ids));
  }
}

/**
 * Create initial trip days with default patterns (used on trip creation).
 */
export async function createInitialTripDays(
  tx: TxOrDb,
  tripId: string,
  startDate: string,
  endDate: string,
) {
  const dates = generateDateRange(startDate, endDate);
  if (dates.length === 0) return;

  const insertedDays = await tx
    .insert(tripDays)
    .values(
      dates.map((date, i) => ({
        tripId,
        date,
        dayNumber: i + 1,
      })),
    )
    .returning({ id: tripDays.id });

  await tx.insert(dayPatterns).values(
    insertedDays.map((day) => ({
      tripDayId: day.id,
      label: DEFAULT_PATTERN_LABEL,
      isDefault: true,
      sortOrder: 0,
    })),
  );
}
