import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index";
import { routeCache, trips } from "../db/schema";
import { getAppSettings } from "../lib/app-settings";
import { ERROR_MSG } from "../lib/constants";
import { logger } from "../lib/logger";
import { checkTripAccess } from "../lib/permissions";
import { getAdminUserId } from "../lib/resolve-is-admin";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

// Round to 4 decimal places (~11m accuracy) for cache key
function buildCacheKey(oLat: number, oLng: number, dLat: number, dLng: number): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(oLat)},${r(oLng)}:${r(dLat)},${r(dLng)}`;
}

export const directionsRoutes = new Hono<AppEnv>();

directionsRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user");
  const { tripId, originLat, originLng, destLat, destLng } = c.req.query();

  if (!tripId || !originLat || !originLng || !destLat || !destLng) {
    return c.json({ error: "Missing required query parameters" }, 400);
  }

  const coords = [originLat, originLng, destLat, destLng].map(Number);
  if (coords.some(Number.isNaN)) {
    return c.json({ error: "Invalid coordinate values" }, 400);
  }
  const [oLat, oLng, dLat, dLng] = coords;

  const role = await checkTripAccess(tripId, user.id);
  if (!role) {
    return c.json({ error: ERROR_MSG.FORBIDDEN }, 403);
  }

  const settings = await getAppSettings();

  if (settings.mapsMode === "off") {
    return c.json({ error: ERROR_MSG.FORBIDDEN }, 403);
  }

  if (settings.mapsMode === "admin_only") {
    const trip = await db.query.trips.findFirst({
      where: eq(trips.id, tripId),
      columns: { ownerId: true },
    });
    const adminUserId = await getAdminUserId();
    if (!trip || trip.ownerId !== adminUserId) {
      return c.json({ error: ERROR_MSG.FORBIDDEN }, 403);
    }
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Maps not configured" }, 503);
  }

  const cacheKey = buildCacheKey(oLat, oLng, dLat, dLng);

  // Check cache
  const cached = await db
    .select({
      durationSeconds: routeCache.durationSeconds,
      encodedPolyline: routeCache.encodedPolyline,
    })
    .from(routeCache)
    .where(eq(routeCache.cacheKey, cacheKey));

  if (cached.length > 0) {
    return c.json(cached[0]);
  }

  const body = {
    origin: {
      location: {
        latLng: { latitude: oLat, longitude: oLng },
      },
    },
    destination: {
      location: {
        latLng: { latitude: dLat, longitude: dLng },
      },
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
  };

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return c.json({ error: "Routes API error" }, 502);
  }

  const data = (await res.json()) as {
    routes?: Array<{ duration?: string; polyline?: { encodedPolyline?: string } }>;
  };
  const route = data.routes?.[0];
  if (!route) {
    return c.json({ error: "No route found" }, 404);
  }

  const durationSeconds = route.duration ? Number.parseInt(route.duration.replace("s", ""), 10) : 0;
  const encodedPolyline = route.polyline?.encodedPolyline ?? null;

  // Store in cache (fire-and-forget, ignore conflicts)
  db.insert(routeCache)
    .values({ cacheKey, durationSeconds, encodedPolyline })
    .onConflictDoNothing()
    .then(
      () => {},
      (err) => logger.error({ err }, "Route cache insert failed"),
    );

  return c.json({ durationSeconds, encodedPolyline });
});
