import { currencyCodeSchema } from "@sugara/shared";
import { Hono } from "hono";
import { RATE_LIMIT_PUBLIC_RESOURCE } from "../lib/constants";
import { fetchExchangeRate } from "../lib/exchange-rate";
import { requireAuth } from "../middleware/auth";
import { rateLimitByIp } from "../middleware/rate-limit";
import type { AppEnv } from "../types";

export const exchangeRateRoutes = new Hono<AppEnv>();

const exchangeRateRateLimit = rateLimitByIp(RATE_LIMIT_PUBLIC_RESOURCE);

// GET /api/exchange-rate?from=USD&to=JPY
exchangeRateRoutes.get("/", requireAuth, exchangeRateRateLimit, async (c) => {
  const { from, to } = c.req.query();

  if (!from || !to) {
    return c.json({ error: "Missing required query parameters: from and to" }, 400);
  }

  const fromResult = currencyCodeSchema.safeParse(from);
  if (!fromResult.success) {
    return c.json({ error: `Invalid currency code for 'from': ${from}` }, 400);
  }

  const toResult = currencyCodeSchema.safeParse(to);
  if (!toResult.success) {
    return c.json({ error: `Invalid currency code for 'to': ${to}` }, 400);
  }

  const rate = await fetchExchangeRate(fromResult.data, toResult.data);
  if (rate === null) {
    return c.json({ error: "Exchange rate service unavailable" }, 502);
  }

  return c.json({ rate, from: fromResult.data, to: toResult.data });
});
