import type { MemberRole } from "@sugara/shared";
import { canEdit, MAX_PARTICIPANTS_PER_POLL } from "@sugara/shared";
import { and, count, eq } from "drizzle-orm";
import { db } from "../db/index";
import { schedulePollParticipants, schedulePolls, tripMembers } from "../db/schema";

export async function findPollAsOwner(pollId: string, userId: string) {
  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.id, pollId),
    with: { trip: { columns: { ownerId: true } } },
  });
  if (!poll) return null;
  if (poll.trip.ownerId !== userId) return null;
  return poll;
}

/**
 * Find poll if user is the owner or a trip member with editor+ role.
 * Returns { poll, isOwner } to allow callers to restrict fields for non-owners.
 * Uses tripMembers as single source of truth for role-based access.
 */
export async function findPollAsEditor(pollId: string, userId: string) {
  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.id, pollId),
  });
  if (!poll) return null;

  const member = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, poll.tripId), eq(tripMembers.userId, userId)),
  });
  if (!member || !canEdit(member.role as MemberRole)) return null;

  return { poll, isOwner: (member.role as MemberRole) === "owner" };
}

/**
 * Find poll if user has access as owner, explicit participant, or trip member.
 * When a trip member accesses the poll for the first time, auto-add them as participant.
 */
export async function findPollAsParticipant(pollId: string, userId: string) {
  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.id, pollId),
    with: {
      trip: { columns: { ownerId: true, title: true, destination: true } },
      participants: {
        where: eq(schedulePollParticipants.userId, userId),
      },
    },
  });
  if (!poll) return null;

  // Owner always has access
  if (poll.trip.ownerId === userId) return poll;

  // Explicit participant
  if (poll.participants.length > 0) return poll;

  // Check trip membership
  const member = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, poll.tripId), eq(tripMembers.userId, userId)),
  });
  if (member) {
    const [{ count: participantCount }] = await db
      .select({ count: count() })
      .from(schedulePollParticipants)
      .where(eq(schedulePollParticipants.pollId, pollId));

    // Intentional write side-effect: auto-add trip members as poll participants
    // on first access so they can immediately respond. This is by design because
    // poll participation is tied to trip membership.
    // Guard against exceeding the limit (should not happen in practice since
    // MAX_PARTICIPANTS_PER_POLL === MAX_MEMBERS_PER_TRIP, but defensive check).
    if (Number(participantCount) < MAX_PARTICIPANTS_PER_POLL) {
      await db.insert(schedulePollParticipants).values({ pollId, userId }).onConflictDoNothing();
    }
    return poll;
  }

  return null;
}
