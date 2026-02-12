import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "../db/index";
import { activityLogs } from "../db/schema";
import { MAX_LOGS_PER_TRIP } from "./constants";

type LogActivityParams = {
  tripId: string;
  userId: string;
  action: string;
  entityType: string;
  entityName?: string;
  detail?: string;
};

export async function logActivity(params: LogActivityParams): Promise<void> {
  await db.insert(activityLogs).values({
    tripId: params.tripId,
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityName: params.entityName ?? null,
    detail: params.detail ?? null,
  });

  // Keep only the latest MAX_LOGS_PER_TRIP entries per trip
  const keepIds = await db
    .select({ id: activityLogs.id })
    .from(activityLogs)
    .where(eq(activityLogs.tripId, params.tripId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(MAX_LOGS_PER_TRIP);

  const keepIdList = keepIds.map((r) => r.id);
  if (keepIdList.length >= MAX_LOGS_PER_TRIP) {
    await db
      .delete(activityLogs)
      .where(and(eq(activityLogs.tripId, params.tripId), notInArray(activityLogs.id, keepIdList)));
  }
}
