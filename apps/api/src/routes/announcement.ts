import { get } from "@vercel/edge-config";
import { Hono } from "hono";
import { logger } from "../lib/logger";
import type { AppEnv } from "../types";

const announcementRoutes = new Hono<AppEnv>();

announcementRoutes.get("/api/announcement", async (c) => {
  if (!process.env.EDGE_CONFIG) {
    return c.json({ message: null });
  }
  try {
    const value = await get<string>("announcement");
    return c.json({ message: value || null });
  } catch (err) {
    logger.error({ err }, "Edge Config fetch failed");
    return c.json({ message: null });
  }
});

export { announcementRoutes };
