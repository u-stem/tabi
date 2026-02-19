import type { MemberRole } from "@sugara/shared";
import { canEdit } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index";
import { schedulePollParticipants, schedulePolls, tripMembers } from "../db/schema";

export async function findPollAsOwner(pollId: string, userId: string) {
  return db.query.schedulePolls.findFirst({
    where: and(eq(schedulePolls.id, pollId), eq(schedulePolls.ownerId, userId)),
  });
}

/**
 * Find poll if user is the owner or a trip member with editor+ role.
 * Returns { poll, isOwner } to allow callers to restrict fields for non-owners.
 */
export async function findPollAsEditor(pollId: string, userId: string) {
  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.id, pollId),
  });
  if (!poll) return null;

  if (poll.ownerId === userId) return { poll, isOwner: true as const };

  if (poll.tripId) {
    const member = await db.query.tripMembers.findFirst({
      where: and(eq(tripMembers.tripId, poll.tripId), eq(tripMembers.userId, userId)),
    });
    if (member && canEdit(member.role as MemberRole)) {
      return { poll, isOwner: false as const };
    }
  }

  return null;
}

/**
 * Find poll if user has access as owner, explicit participant, or trip member.
 * When a trip member accesses the poll for the first time, auto-add them as participant.
 */
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

  // Owner always has access
  if (poll.ownerId === userId) return poll;

  // Explicit participant
  if (poll.participants.length > 0) return poll;

  // Check trip membership if poll is linked to a trip
  if (poll.tripId) {
    const member = await db.query.tripMembers.findFirst({
      where: and(eq(tripMembers.tripId, poll.tripId), eq(tripMembers.userId, userId)),
    });
    if (member) {
      // Auto-add as poll participant so they can respond
      await db.insert(schedulePollParticipants).values({ pollId, userId }).onConflictDoNothing();
      return poll;
    }
  }

  return null;
}
