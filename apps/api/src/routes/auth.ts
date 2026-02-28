import { Hono } from "hono";
import { getAppSettings } from "../lib/app-settings";
import { auth } from "../lib/auth";

const authRoutes = new Hono();

// Block email/password signup when the admin has disabled new registrations.
// Anonymous sign-in (/api/auth/sign-in/anonymous) is intentionally not blocked
// because guest accounts are ephemeral (7-day TTL) and accumulate minimal data.
authRoutes.post("/api/auth/sign-up/*", async (c, next) => {
  // Fail-open on DB errors: if settings can't be read, allow signup rather than
  // blocking all registrations due to a transient DB issue.
  const { signupEnabled } = await getAppSettings().catch(() => ({ signupEnabled: true }));
  if (!signupEnabled) {
    return c.json({ error: "新規利用の受付を停止しています" }, 403);
  }
  return next();
});

authRoutes.on(["POST", "GET"], "/api/auth/*", (c) => {
  return auth.handler(c.req.raw);
});

export { authRoutes };
