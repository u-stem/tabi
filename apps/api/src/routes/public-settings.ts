import { Hono } from "hono";
import { getAppSettings } from "../lib/app-settings";

const publicSettingsRoutes = new Hono();

publicSettingsRoutes.get("/api/public/settings", async (c) => {
  const settings = await getAppSettings();
  return c.json({ signupEnabled: settings.signupEnabled });
});

export { publicSettingsRoutes };
