import { Hono } from "hono";
import { getAppSettings } from "../lib/app-settings";
import { auth } from "../lib/auth";
import { ERROR_MSG } from "../lib/constants";

const authRoutes = new Hono();

// Block email/password signup when the admin has disabled new registrations.
// Anonymous sign-in (/api/auth/sign-in/anonymous) is intentionally not blocked
// because guest accounts are ephemeral (7-day TTL) and accumulate minimal data.
authRoutes.post("/api/auth/sign-up/*", async (c, next) => {
  // Fail-closed on DB errors: a DB failure is a systemic issue that warrants
  // blocking signup rather than silently allowing registrations.
  const { signupEnabled } = await getAppSettings().catch(() => ({ signupEnabled: false }));
  if (!signupEnabled) {
    return c.json({ error: ERROR_MSG.SIGNUP_DISABLED }, 403);
  }
  return next();
});

authRoutes.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

export { authRoutes };
