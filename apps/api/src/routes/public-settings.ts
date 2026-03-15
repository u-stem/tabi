import { Hono } from "hono";
import { getAppSettings } from "../lib/app-settings";

const publicSettingsRoutes = new Hono();

publicSettingsRoutes.get("/api/public/settings", async (c) => {
  const settings = await getAppSettings();
  c.header("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=600");
  return c.json({ signupEnabled: settings.signupEnabled });
});

export { publicSettingsRoutes };
