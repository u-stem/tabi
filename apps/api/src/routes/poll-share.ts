import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { schedulePolls } from "../db/schema";
import { ERROR_MSG } from "../lib/constants";
import { rateLimitByIp } from "../middleware/rate-limit";

const pollShareRoutes = new Hono();

const sharedPollRateLimit = rateLimitByIp({ window: 60, max: 30 });

// Get shared poll (no auth)
pollShareRoutes.get("/api/polls/shared/:token", sharedPollRateLimit, async (c) => {
  const token = c.req.param("token");

  const poll = await db.query.schedulePolls.findFirst({
    where: eq(schedulePolls.shareToken, token),
    with: {
      trip: { columns: { title: true, destination: true } },
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

  if (poll.shareTokenExpiresAt && poll.shareTokenExpiresAt < new Date()) {
    return c.json({ error: ERROR_MSG.POLL_SHARED_NOT_FOUND }, 404);
  }

  return c.json({
    id: poll.id,
    title: poll.trip.title,
    destination: poll.trip.destination,
    note: poll.note,
    status: poll.status,
    deadline: poll.deadline?.toISOString() ?? null,
    confirmedOptionId: poll.confirmedOptionId,
    shareExpiresAt: poll.shareTokenExpiresAt?.toISOString() ?? null,
    options: poll.options.map((o) => ({
      id: o.id,
      startDate: o.startDate,
      endDate: o.endDate,
      sortOrder: o.sortOrder,
    })),
    participants: poll.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: p.user?.name ?? "Unknown user",
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

export { pollShareRoutes };
