import { guestPollResponsesSchema } from "@sugara/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { schedulePollParticipants, schedulePollResponses, schedulePolls } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";

const pollShareRoutes = new Hono();

// Get shared poll (no auth)
pollShareRoutes.get("/api/polls/shared/:token", async (c) => {
  const token = c.req.param("token");

  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.shareToken, token),
    with: {
      options: { orderBy: (o, { asc }) => [asc(o.sortOrder)] },
      participants: {
        with: {
          user: { columns: { id: true, name: true, image: true } },
          responses: true,
        },
      },
    },
  });

  if (!poll) return c.json({ error: ERROR_MSG.POLL_SHARED_NOT_FOUND }, 404);

  return c.json({
    id: poll.id,
    ownerId: poll.ownerId,
    title: poll.title,
    destination: poll.destination,
    note: poll.note,
    status: poll.status,
    deadline: poll.deadline?.toISOString() ?? null,
    confirmedOptionId: poll.confirmedOptionId,
    tripId: poll.tripId,
    options: poll.options.map((o) => ({
      id: o.id,
      startDate: o.startDate,
      endDate: o.endDate,
      sortOrder: o.sortOrder,
    })),
    participants: poll.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name ?? p.guestName ?? "Guest",
      image: p.user?.image ?? null,
      responses: p.responses.map((r) => ({
        optionId: r.optionId,
        response: r.response,
      })),
    })),
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
  });
});

// Guest response (no auth)
pollShareRoutes.post("/api/polls/shared/:token/responses", async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json();
  const parsed = guestPollResponsesSchema.safeParse(body);

  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.shareToken, token),
  });
  if (!poll) return c.json({ error: ERROR_MSG.POLL_SHARED_NOT_FOUND }, 404);
  if (poll.status !== "open") return c.json({ error: ERROR_MSG.POLL_NOT_OPEN }, 400);
  if (poll.deadline && poll.deadline < new Date()) {
    return c.json({ error: ERROR_MSG.POLL_DEADLINE_PASSED }, 400);
  }

  await db.transaction(async (tx) => {
    const [participant] = await tx
      .insert(schedulePollParticipants)
      .values({ pollId: poll.id, guestName: parsed.data.guestName })
      .returning();

    if (parsed.data.responses.length > 0) {
      await tx.insert(schedulePollResponses).values(
        parsed.data.responses.map((r) => ({
          participantId: participant.id,
          optionId: r.optionId,
          response: r.response,
        })),
      );
    }
  });

  await db
    .update(schedulePolls)
    .set({ updatedAt: new Date() })
    .where(eq(schedulePolls.id, poll.id));

  return c.json({ ok: true });
});

export { pollShareRoutes };
