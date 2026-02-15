import type { Context, Next } from "hono";
import { ERROR_MSG } from "../lib/constants";
import { canEdit, checkTripAccess, isOwner } from "../lib/permissions";
import type { AppEnv } from "../types";

type AccessLevel = "viewer" | "editor" | "owner";

/**
 * Middleware that checks trip membership and required access level.
 * Sets `tripRole` on the context for downstream handlers.
 * @param level - Minimum access level required (default: "viewer")
 * @param paramName - Route param name for trip ID (default: "tripId")
 */
export function requireTripAccess(level: AccessLevel = "viewer", paramName = "tripId") {
  return async (c: Context<AppEnv>, next: Next) => {
    const user = c.get("user");
    const tripId = c.req.param(paramName);
    const role = await checkTripAccess(tripId, user.id);

    if (!role || (level === "editor" && !canEdit(role)) || (level === "owner" && !isOwner(role))) {
      return c.json({ error: ERROR_MSG.TRIP_NOT_FOUND }, 404);
    }

    c.set("tripRole", role);
    await next();
  };
}
