import type { Context, Next } from "hono";
import { auth } from "../lib/auth";
import { ERROR_MSG } from "../lib/constants";
import { logger } from "../lib/logger";
import type { AuthUser } from "../types";

export async function requireAuth(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session) {
      return c.json({ error: ERROR_MSG.UNAUTHORIZED }, 401);
    }

    const user = session.user as AuthUser;
    c.set("user", user);
    c.set("session", session.session);

    if (user.guestExpiresAt && new Date(user.guestExpiresAt) < new Date()) {
      return c.json({ error: ERROR_MSG.GUEST_EXPIRED }, 401);
    }

    await next();
  } catch (err) {
    logger.error({ err }, "Auth middleware error");
    return c.json({ error: ERROR_MSG.UNAUTHORIZED }, 401);
  }
}
