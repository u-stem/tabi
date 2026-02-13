import { and, asc, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { db } from "../db/index";
import { scheduleReactions, schedules } from "../db/schema";

export async function queryCandidatesWithReactions(tripId: string, userId: string) {
  return db
    .select({
      ...getTableColumns(schedules),
      likeCount: sql<number>`count(*) filter (where ${scheduleReactions.type} = 'like')`.as(
        "like_count",
      ),
      hmmCount: sql<number>`count(*) filter (where ${scheduleReactions.type} = 'hmm')`.as(
        "hmm_count",
      ),
      myReaction: sql<
        string | null
      >`max(case when ${scheduleReactions.userId} = ${userId} then ${scheduleReactions.type} end)`.as(
        "my_reaction",
      ),
    })
    .from(schedules)
    .leftJoin(scheduleReactions, eq(schedules.id, scheduleReactions.scheduleId))
    .where(and(eq(schedules.tripId, tripId), isNull(schedules.dayPatternId)))
    .groupBy(schedules.id)
    .orderBy(asc(schedules.sortOrder));
}
