import type { Context, Next } from "hono";
import { auth } from "../lib/auth";

// Unlike requireAuth, this middleware does not reject unauthenticated requests.
// It attaches user/session to context when a valid session exists.
export async function optionalAuth(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (session) {
      c.set("user", session.user);
      c.set("session", session.session);
    }
  } catch {
    // Proceed as unauthenticated
  }
  await next();
}
