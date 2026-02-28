import type { Context, Next } from "hono";
import type { AppEnv } from "../types";

export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const user = c.get("user");

  // Check email rather than username because Better Auth's cookieCache may omit
  // plugin-added fields (username). Email is a core field always present in the session.
  // Admin users are created with email <adminUsername>@sugara.local (see db:seed-user).
  if (user.email !== `${adminUsername}@sugara.local`) {
    return c.json({ error: "Forbidden" }, 403);
  }

  await next();
}
