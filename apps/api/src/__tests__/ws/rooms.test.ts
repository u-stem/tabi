import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  broadcastPresence,
  broadcastToTrip,
  getPresence,
  joinRoom,
  leaveAll,
  leaveRoom,
  startHeartbeat,
  stopHeartbeat,
  touchConnection,
  updatePresence,
} from "../../ws/rooms";
import type { PresenceUser } from "../../ws/types";

function createMockWs() {
  return { send: vi.fn(), close: vi.fn() };
}

describe("Room management", () => {
  beforeEach(() => {
    leaveAll();
  });

  describe("joinRoom / leaveRoom", () => {
    it("adds user to room", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);

      expect(getPresence("trip-1")).toEqual([user]);
    });

    it("removes user from room on leave", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      leaveRoom("trip-1", ws);

      expect(getPresence("trip-1")).toEqual([]);
    });

    it("handles multiple users in same room", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", ws1, user1);
      joinRoom("trip-1", ws2, user2);

      expect(getPresence("trip-1")).toHaveLength(2);
    });

    it("returns empty array for non-existent room", () => {
      expect(getPresence("no-room")).toEqual([]);
    });

    it("deduplicates same user with multiple connections", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws1, user);
      joinRoom("trip-1", ws2, user);

      expect(getPresence("trip-1")).toHaveLength(1);
    });
  });

  describe("broadcastToTrip", () => {
    it("sends message to all members except sender", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", ws1, user1);
      joinRoom("trip-1", ws2, user2);

      broadcastToTrip("trip-1", "u1", {
        type: "schedule:deleted",
        dayId: "d1",
        patternId: "p1",
        scheduleId: "s1",
      });

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(ws2.send.mock.calls[0][0]);
      expect(sent.type).toBe("schedule:deleted");
    });

    it("does nothing for non-existent room", () => {
      broadcastToTrip("no-room", "u1", {
        type: "schedule:deleted",
        dayId: "d1",
        patternId: "p1",
        scheduleId: "s1",
      });
    });
  });

  describe("broadcastPresence", () => {
    it("sends other users only (excludes self)", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: "d1", patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", ws1, user1);
      joinRoom("trip-1", ws2, user2);

      broadcastPresence("trip-1");

      expect(ws1.send).toHaveBeenCalledOnce();
      expect(ws2.send).toHaveBeenCalledOnce();

      const sentToWs1 = JSON.parse(ws1.send.mock.calls[0][0]);
      expect(sentToWs1.type).toBe("presence");
      expect(sentToWs1.users).toHaveLength(1);
      expect(sentToWs1.users[0].userId).toBe("u2");

      const sentToWs2 = JSON.parse(ws2.send.mock.calls[0][0]);
      expect(sentToWs2.users).toHaveLength(1);
      expect(sentToWs2.users[0].userId).toBe("u1");
    });

    it("sends empty list when user is alone", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      broadcastPresence("trip-1");

      const sent = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sent.users).toHaveLength(0);
    });

    it("continues sending to healthy connections when one throws", () => {
      const wsBroken = createMockWs();
      const wsHealthy = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", wsBroken, user1);
      joinRoom("trip-1", wsHealthy, user2);
      wsBroken.send.mockImplementation(() => {
        throw new Error("connection lost");
      });

      broadcastPresence("trip-1");

      expect(wsHealthy.send).toHaveBeenCalledOnce();
    });
  });

  describe("broadcastToTrip", () => {
    it("sends message to all members except sender", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", ws1, user1);
      joinRoom("trip-1", ws2, user2);

      broadcastToTrip("trip-1", "u1", {
        type: "schedule:deleted",
        dayId: "d1",
        patternId: "p1",
        scheduleId: "s1",
      });

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(ws2.send.mock.calls[0][0]);
      expect(sent.type).toBe("schedule:deleted");
    });

    it("does nothing for non-existent room", () => {
      broadcastToTrip("no-room", "u1", {
        type: "schedule:deleted",
        dayId: "d1",
        patternId: "p1",
        scheduleId: "s1",
      });
    });

    it("continues sending to healthy connections when one throws", () => {
      const wsBroken = createMockWs();
      const wsHealthy = createMockWs();
      const wsSender = createMockWs();
      const u1: PresenceUser = { userId: "u1", name: "Sender", dayId: null, patternId: null };
      const u2: PresenceUser = { userId: "u2", name: "Broken", dayId: null, patternId: null };
      const u3: PresenceUser = { userId: "u3", name: "Healthy", dayId: null, patternId: null };

      joinRoom("trip-1", wsSender, u1);
      joinRoom("trip-1", wsBroken, u2);
      joinRoom("trip-1", wsHealthy, u3);
      wsBroken.send.mockImplementation(() => {
        throw new Error("connection lost");
      });

      broadcastToTrip("trip-1", "u1", {
        type: "schedule:deleted",
        dayId: "d1",
        patternId: "p1",
        scheduleId: "s1",
      });

      expect(wsHealthy.send).toHaveBeenCalledOnce();
    });
  });

  describe("updatePresence", () => {
    it("updates user presence data", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      updatePresence("trip-1", ws, { dayId: "d1", patternId: "p1" });

      const presence = getPresence("trip-1");
      expect(presence[0].dayId).toBe("d1");
      expect(presence[0].patternId).toBe("p1");
    });

    it("preserves userId and name on update", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      updatePresence("trip-1", ws, { dayId: "d1", patternId: null });

      const presence = getPresence("trip-1");
      expect(presence[0].userId).toBe("u1");
      expect(presence[0].name).toBe("Alice");
    });
  });

  describe("heartbeat", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      stopHeartbeat();
      vi.useRealTimers();
    });

    it("sends ping to all connections periodically", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      touchConnection(ws);
      startHeartbeat();

      vi.advanceTimersByTime(15_000);

      const pingSent = ws.send.mock.calls.some(
        (call: string[]) => JSON.parse(call[0]).type === "ping",
      );
      expect(pingSent).toBe(true);
    });

    it("closes stale connections that exceed threshold", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      touchConnection(ws);
      startHeartbeat();

      // Advance past the stale threshold (45s) + heartbeat interval (15s)
      vi.advanceTimersByTime(60_000);

      expect(ws.close).toHaveBeenCalled();
    });

    it("does not close connections that are recently active", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      touchConnection(ws);
      startHeartbeat();

      // Advance 15s, then touch (simulating pong), then advance 15s more
      vi.advanceTimersByTime(15_000);
      touchConnection(ws);
      vi.advanceTimersByTime(15_000);

      expect(ws.close).not.toHaveBeenCalled();
    });

    it("removes stale connection from presence", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", ws1, user1);
      joinRoom("trip-1", ws2, user2);
      touchConnection(ws1);
      touchConnection(ws2);
      startHeartbeat();

      // Only ws2 stays active
      vi.advanceTimersByTime(15_000);
      touchConnection(ws2);
      vi.advanceTimersByTime(15_000);
      touchConnection(ws2);
      vi.advanceTimersByTime(15_000);
      touchConnection(ws2);
      // ws1 lastActive=0, now=60s -> 60s > 45s threshold
      vi.advanceTimersByTime(15_000);

      expect(ws1.close).toHaveBeenCalled();
      expect(getPresence("trip-1")).toEqual([user2]);
    });

    it("notifies remaining users when ping send fails", () => {
      const wsBroken = createMockWs();
      const wsHealthy = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", wsBroken, user1);
      joinRoom("trip-1", wsHealthy, user2);
      touchConnection(wsBroken);
      touchConnection(wsHealthy);
      startHeartbeat();

      // Make ping throw for broken connection
      wsBroken.send.mockImplementation(() => {
        throw new Error("connection lost");
      });

      vi.advanceTimersByTime(15_000);

      // wsHealthy should receive a presence update without user1
      const presenceMessages = wsHealthy.send.mock.calls
        .map((call: string[]) => JSON.parse(call[0]))
        .filter((msg: { type: string }) => msg.type === "presence");
      expect(presenceMessages.length).toBeGreaterThan(0);
      const lastPresence = presenceMessages[presenceMessages.length - 1];
      expect(lastPresence.users.every((u: PresenceUser) => u.userId !== "u1")).toBe(true);
    });
  });
});
