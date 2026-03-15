import { quickPollDeleteVoteSchema, quickPollVoteSchema } from "@sugara/shared";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { quickPolls, quickPollVotes } from "../db/schema";
import { auth } from "../lib/auth";
import { ERROR_MSG, RATE_LIMIT_PUBLIC_RESOURCE } from "../lib/constants";
import { rateLimitByIp } from "../middleware/rate-limit";
import type { AuthUser } from "../types";

const quickPollShareRoutes = new Hono();
const rateLimit = rateLimitByIp(RATE_LIMIT_PUBLIC_RESOURCE);

// Get poll by share token (no auth required)
quickPollShareRoutes.get("/api/quick-polls/s/:shareToken", rateLimit, async (c) => {
  const shareToken = c.req.param("shareToken");

  const poll = await db.query.quickPolls.findFirst({
    where: eq(quickPolls.shareToken, shareToken),
    with: {
      options: { orderBy: (o, { asc }) => [asc(o.sortOrder)] },
      votes: { columns: { id: true, optionId: true, userId: true, anonymousId: true } },
    },
  });

  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  if (poll.status === "open" && poll.expiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);
  }

  // Try to identify current user for myVoteOptionIds
  const user = await getOptionalUser(c);
  const anonymousId = c.req.header("x-anonymous-id");

  const myVoteOptionIds = poll.votes
    .filter((v) => {
      if (user && v.userId === user.id) return true;
      if (anonymousId && v.anonymousId === anonymousId) return true;
      return false;
    })
    .map((v) => v.optionId);

  // Contains per-user vote state (myVoteOptionIds), so must not be cached publicly
  c.header("Cache-Control", "private, no-cache");
  return c.json({
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    showResultsBeforeVote: poll.showResultsBeforeVote,
    status: poll.status === "open" && poll.expiresAt < new Date() ? "closed" : poll.status,
    creatorId: poll.creatorId,
    expiresAt: poll.expiresAt.toISOString(),
    createdAt: poll.createdAt.toISOString(),
    options: poll.options.map((o) => ({
      id: o.id,
      label: o.label,
      sortOrder: o.sortOrder,
      voteCount: poll.votes.filter((v) => v.optionId === o.id).length,
    })),
    totalVotes: poll.votes.length,
    myVoteOptionIds,
  });
});

// Vote (no auth required)
quickPollShareRoutes.post("/api/quick-polls/s/:shareToken/vote", rateLimit, async (c) => {
  const shareToken = c.req.param("shareToken");
  const parsed = quickPollVoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { optionIds, anonymousId } = parsed.data;

  const poll = await db.query.quickPolls.findFirst({
    where: eq(quickPolls.shareToken, shareToken),
    with: { options: { columns: { id: true } } },
  });

  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  if (poll.status !== "open" || poll.expiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_OPEN }, 400);
  }

  if (!poll.allowMultiple && optionIds.length > 1) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_SINGLE_VOTE_ONLY }, 400);
  }

  // Validate all optionIds belong to this poll
  const validIds = new Set(poll.options.map((o) => o.id));
  if (optionIds.some((id) => !validIds.has(id))) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_INVALID_OPTION }, 400);
  }

  const user = await getOptionalUser(c);
  const voterId = user?.id ?? null;
  // NOTE: anonymousId is client-generated (localStorage UUID). A determined user
  // can forge different IDs to vote multiple times. Acceptable trade-off for
  // a lightweight poll feature; use authenticated voting for important decisions.
  const voterAnonymousId = !voterId ? anonymousId : undefined;

  if (!voterId && !voterAnonymousId) {
    return c.json({ error: "userId or anonymousId required" }, 400);
  }

  // Remove existing votes for this user/anonymous
  const deleteCondition = voterId
    ? and(eq(quickPollVotes.pollId, poll.id), eq(quickPollVotes.userId, voterId))
    : and(
        eq(quickPollVotes.pollId, poll.id),
        eq(quickPollVotes.anonymousId, voterAnonymousId as string),
      );
  await db.delete(quickPollVotes).where(deleteCondition);

  // Insert new votes
  await db.insert(quickPollVotes).values(
    optionIds.map((optionId) => ({
      pollId: poll.id,
      optionId,
      userId: voterId,
      anonymousId: voterAnonymousId ?? null,
    })),
  );

  return c.json({ ok: true });
});

// Cancel vote (no auth required)
quickPollShareRoutes.delete("/api/quick-polls/s/:shareToken/vote", rateLimit, async (c) => {
  const shareToken = c.req.param("shareToken");

  const body = await c.req.json().catch(() => ({}));
  const parsed = quickPollDeleteVoteSchema.safeParse(body);
  const anonymousId = parsed.success ? parsed.data.anonymousId : undefined;

  const poll = await db.query.quickPolls.findFirst({
    where: eq(quickPolls.shareToken, shareToken),
    columns: { id: true, status: true, expiresAt: true },
  });

  if (!poll) return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_FOUND }, 404);

  if (poll.status !== "open" || poll.expiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.QUICK_POLL_NOT_OPEN }, 400);
  }

  const user = await getOptionalUser(c);
  const voterId = user?.id ?? null;
  const voterAnonymousId = !voterId ? anonymousId : undefined;

  if (!voterId && !voterAnonymousId) {
    return c.json({ error: "userId or anonymousId required" }, 400);
  }

  const deleteCondition = voterId
    ? and(eq(quickPollVotes.pollId, poll.id), eq(quickPollVotes.userId, voterId))
    : and(
        eq(quickPollVotes.pollId, poll.id),
        eq(quickPollVotes.anonymousId, voterAnonymousId as string),
      );
  await db.delete(quickPollVotes).where(deleteCondition);

  return c.json({ ok: true });
});

async function getOptionalUser(c: {
  req: { raw: { headers: Headers } };
}): Promise<AuthUser | null> {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return (session?.user as AuthUser) ?? null;
  } catch {
    return null;
  }
}

export { quickPollShareRoutes };
