import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  broadcastPresence,
  broadcastToTrip,
  getPresence,
  joinRoom,
  leaveAll,
  leaveRoom,
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
        type: "spot:deleted",
        dayId: "d1",
        patternId: "p1",
        spotId: "s1",
      });

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(ws2.send.mock.calls[0][0]);
      expect(sent.type).toBe("spot:deleted");
    });

    it("does nothing for non-existent room", () => {
      broadcastToTrip("no-room", "u1", {
        type: "spot:deleted",
        dayId: "d1",
        patternId: "p1",
        spotId: "s1",
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
});
