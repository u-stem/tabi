import type { PresenceUser, ServerMessage } from "./types";

export type WsLike = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

const rooms = new Map<string, Map<WsLike, PresenceUser>>();

export function joinRoom(tripId: string, ws: WsLike, user: PresenceUser): void {
  let room = rooms.get(tripId);
  if (!room) {
    room = new Map();
    rooms.set(tripId, room);
  }
  room.set(ws, user);
}

export function leaveRoom(tripId: string, ws: WsLike): void {
  const room = rooms.get(tripId);
  if (!room) return;
  room.delete(ws);
  if (room.size === 0) {
    rooms.delete(tripId);
  }
}

export function leaveAll(): void {
  rooms.clear();
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

// Skips ALL connections for senderId, so a user's other tabs won't receive
// the update. This is acceptable since the sender's own REST response provides
// the data, and the initiating tab already calls onRefresh/fetchTrip.
export function broadcastToTrip(tripId: string, senderId: string, message: ServerMessage): void {
  const room = rooms.get(tripId);
  if (!room) return;
  const data = JSON.stringify(message);
  for (const [ws, user] of room) {
    if (user.userId !== senderId) {
      ws.send(data);
    }
  }
}

export function broadcastPresence(tripId: string): void {
  const room = rooms.get(tripId);
  if (!room) return;
  const users = [...room.values()];
  const data = JSON.stringify({ type: "presence" as const, users });
  for (const [ws] of room) {
    ws.send(data);
  }
}
