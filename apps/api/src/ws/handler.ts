import type { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { auth } from "../lib/auth";
import { checkTripAccess } from "../lib/permissions";
import { broadcastPresence, joinRoom, leaveRoom, updatePresence } from "./rooms";

const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

export function registerWebSocket(app: Hono): void {
  app.get(
    "/ws/trips/:tripId",
    upgradeWebSocket((c) => {
      const tripId = c.req.param("tripId");
      const headers = c.req.raw.headers;

      return {
        async onOpen(_evt, ws) {
          const session = await auth.api.getSession({ headers });
          if (!session) {
            ws.close(4401, "Unauthorized");
            return;
          }

          const role = await checkTripAccess(tripId, session.user.id);
          if (!role) {
            ws.close(4403, "Not a member");
            return;
          }

          joinRoom(tripId, ws, {
            userId: session.user.id,
            name: session.user.name,
            dayId: null,
            patternId: null,
          });
          broadcastPresence(tripId);
        },

        onMessage(evt, ws) {
          try {
            if (typeof evt.data !== "string") return;
            const msg = JSON.parse(evt.data);
            if (
              msg.type === "presence:update" &&
              typeof msg.dayId === "string" &&
              (msg.patternId === null || typeof msg.patternId === "string")
            ) {
              updatePresence(tripId, ws, {
                dayId: msg.dayId,
                patternId: msg.patternId,
              });
              broadcastPresence(tripId);
            }
          } catch {
            // Ignore malformed messages
          }
        },

        onClose(_evt, ws) {
          leaveRoom(tripId, ws);
          broadcastPresence(tripId);
        },
      };
    }),
  );
}
