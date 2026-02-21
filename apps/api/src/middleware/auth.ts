import type { Context, Next } from "hono";
import { auth } from "../lib/auth";
import { ERROR_MSG } from "../lib/constants";
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
    console.error("Auth middleware error:", err);
    return c.json({ error: ERROR_MSG.UNAUTHORIZED }, 401);
  }
}
