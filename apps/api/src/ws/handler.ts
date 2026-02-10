import type { Hono } from "hono";
import { createBunWebSocket } from "hono/bun";
import { auth } from "../lib/auth";
import { WS_CLOSE_CODE } from "../lib/constants";
import { checkTripAccess } from "../lib/permissions";
import {
  broadcastPresence,
  joinRoom,
  leaveRoom,
  startHeartbeat,
  touchConnection,
  updatePresence,
} from "./rooms";

const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

export function registerWebSocket(app: Hono): void {
  startHeartbeat();

  app.get(
    "/ws/trips/:tripId",
    upgradeWebSocket((c) => {
      const tripId = c.req.param("tripId");
      const headers = c.req.raw.headers;

      // Track whether onClose fired before async onOpen completes
      let closed = false;

      return {
        async onOpen(_evt, ws) {
          const session = await auth.api.getSession({ headers });
          if (closed || !session) {
            ws.close(WS_CLOSE_CODE.UNAUTHORIZED, "Unauthorized");
            return;
          }

          const role = await checkTripAccess(tripId, session.user.id);
          if (closed || !role) {
            ws.close(WS_CLOSE_CODE.NOT_A_MEMBER, "Not a member");
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
            if (msg.type === "pong") {
              touchConnection(ws);
              return;
            }
            if (
              msg.type === "presence:update" &&
              typeof msg.dayId === "string" &&
              (msg.patternId === null || typeof msg.patternId === "string")
            ) {
              touchConnection(ws);
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
          closed = true;
          leaveRoom(tripId, ws);
          broadcastPresence(tripId);
        },
      };
    }),
  );
}
