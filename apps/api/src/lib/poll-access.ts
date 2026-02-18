import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { schedulePollParticipants, schedulePolls } from "../db/schema";

export async function findPollAsOwner(pollId: string, userId: string) {
  return db.query.schedulePolls.findFirst({
    where: and(eq(schedulePolls.id, pollId), eq(schedulePolls.ownerId, userId)),
  });
}

export async function findPollAsParticipant(pollId: string, userId: string) {
  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.id, pollId),
    with: {
      participants: {
        where: eq(schedulePollParticipants.userId, userId),
      },
    },
  });
  if (!poll) return null;
  // Owner always has access even if not explicitly a participant
  if (poll.ownerId === userId) return poll;
  if (poll.participants.length > 0) return poll;
  return null;
}
