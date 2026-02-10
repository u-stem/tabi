import type { PresenceUser, ServerMessage } from "./types";

export type WsLike = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

const rooms = new Map<string, Map<WsLike, PresenceUser>>();
const lastActiveMap = new Map<WsLike, number>();

const HEARTBEAT_INTERVAL = 15_000;
const STALE_THRESHOLD = 45_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function touchConnection(ws: WsLike): void {
  lastActiveMap.set(ws, Date.now());
}

export function startHeartbeat(): void {
  // Stop any existing timer to prevent duplicates on Bun --hot reload
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [tripId, room] of rooms) {
      const dead: WsLike[] = [];
      for (const [ws] of room) {
        const lastActive = lastActiveMap.get(ws) ?? 0;
        if (now - lastActive > STALE_THRESHOLD) {
          dead.push(ws);
          ws.close();
        } else {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {
            dead.push(ws);
          }
        }
      }
      if (dead.length > 0) {
        purgeDeadConnections(tripId, dead);
        broadcastPresence(tripId);
      }
      if (room.size === 0) {
        rooms.delete(tripId);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

export function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function joinRoom(tripId: string, ws: WsLike, user: PresenceUser): void {
  let room = rooms.get(tripId);
  if (!room) {
    room = new Map();
    rooms.set(tripId, room);
  }
  room.set(ws, user);
  touchConnection(ws);
}

export function leaveRoom(tripId: string, ws: WsLike): void {
  const room = rooms.get(tripId);
  if (!room) return;
  room.delete(ws);
  lastActiveMap.delete(ws);
  if (room.size === 0) {
    rooms.delete(tripId);
  }
}

export function leaveAll(): void {
  rooms.clear();
  lastActiveMap.clear();
}

// Deduplicate by userId (last connection's state wins)
export function getPresence(tripId: string): PresenceUser[] {
  const room = rooms.get(tripId);
  if (!room) return [];
  const byUser = new Map<string, PresenceUser>();
  for (const user of room.values()) {
    byUser.set(user.userId, user);
  }
  return [...byUser.values()];
}

export function updatePresence(
  tripId: string,
  ws: WsLike,
  data: { dayId: string; patternId: string | null },
): void {
  const room = rooms.get(tripId);
  if (!room) return;
  const user = room.get(ws);
  if (!user) return;
  room.set(ws, { ...user, ...data });
}

// Remove dead connections from a room and clean up tracking state
function purgeDeadConnections(tripId: string, dead: WsLike[]): void {
  if (dead.length === 0) return;
  const room = rooms.get(tripId);
  if (!room) return;
  for (const ws of dead) {
    room.delete(ws);
    lastActiveMap.delete(ws);
  }
  if (room.size === 0) {
    rooms.delete(tripId);
  }
}

// Skips ALL connections for senderId, so a user's other tabs won't receive
// the update. This is acceptable since the sender's own REST response provides
// the data, and the initiating tab already calls onRefresh/fetchTrip.
export function broadcastToTrip(tripId: string, senderId: string, message: ServerMessage): void {
  const room = rooms.get(tripId);
  if (!room) return;
  const data = JSON.stringify(message);
  const dead: WsLike[] = [];
  for (const [ws, user] of room) {
    if (user.userId !== senderId) {
      try {
        ws.send(data);
      } catch {
        dead.push(ws);
      }
    }
  }
  purgeDeadConnections(tripId, dead);
}

// Send each connection a deduped presence list excluding themselves
export function broadcastPresence(tripId: string): void {
  const room = rooms.get(tripId);
  if (!room) return;
  const allUsers = getPresence(tripId);
  const dead: WsLike[] = [];
  for (const [ws, self] of room) {
    const others = allUsers.filter((u) => u.userId !== self.userId);
    try {
      ws.send(JSON.stringify({ type: "presence" as const, users: others }));
    } catch {
      dead.push(ws);
    }
  }
  purgeDeadConnections(tripId, dead);
}
