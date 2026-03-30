import { ogpRequestSchema } from "@sugara/shared";
import { Hono } from "hono";
import { fetchOgpTitle } from "../lib/ogp";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const ogpRoutes = new Hono<AppEnv>();
ogpRoutes.use("*", requireAuth);

ogpRoutes.get("/ogp", async (c) => {
  const url = c.req.query("url") ?? "";
  const parsed = ogpRequestSchema.safeParse({ url });
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const title = await fetchOgpTitle(parsed.data.url);
  return c.json({ title });
});

export { ogpRoutes };
