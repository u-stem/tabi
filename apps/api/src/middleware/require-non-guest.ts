import type { Context, Next } from "hono";
import { ERROR_MSG } from "../lib/constants";

export async function requireNonGuest(c: Context, next: Next) {
  const user = c.get("user");
  if (user.isAnonymous) {
    return c.json({ error: ERROR_MSG.GUEST_NOT_ALLOWED }, 403);
  }
  await next();
}
