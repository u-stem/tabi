# Collaborative Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time data sync and presence to the trip detail page via WebSocket.

**Architecture:** REST API handles all writes. On success, routes broadcast a WebSocket message to all connected members (except the sender). Clients receive messages and call `fetchTrip()` to reload. Presence is tracked in-memory per trip room.

**Tech Stack:** Hono WebSocket (hono/bun `createBunWebSocket`), Bun native WebSocket, React custom hooks

**Design doc:** `docs/plans/2026-02-09-collaborative-editing-design.md`

---

## Task 1: WebSocket message types

Define the shared types for WebSocket messages and presence.

**Files:**
- Create: `apps/api/src/ws/types.ts`

**Step 1: Create types file**

```ts
import type { DayPatternResponse, SpotResponse, TripResponse } from "@tabi/shared";

export type PresenceUser = {
  userId: string;
  name: string;
  dayId: string | null;
  patternId: string | null;
};

export type ServerMessage =
  | { type: "spot:created"; dayId: string; patternId: string; spot: SpotResponse }
  | { type: "spot:updated"; dayId: string; patternId: string; spot: SpotResponse }
  | { type: "spot:deleted"; dayId: string; patternId: string; spotId: string }
  | { type: "spot:reordered"; dayId: string; patternId: string; spotIds: string[] }
  | { type: "pattern:created"; dayId: string; pattern: DayPatternResponse }
  | { type: "pattern:updated"; dayId: string; pattern: DayPatternResponse }
  | { type: "pattern:deleted"; dayId: string; patternId: string }
  | { type: "pattern:duplicated"; dayId: string; pattern: DayPatternResponse }
  | { type: "trip:updated"; trip: TripResponse }
  | { type: "presence"; users: PresenceUser[] };

export type ClientMessage = { type: "presence:update"; dayId: string; patternId: string | null };
```

**Step 2: Verify types compile**

Run: `bun run --filter @tabi/api check-types`
Expected: PASS

**Step 3: Commit**

```
feat: WebSocketメッセージ型を追加
```

---

## Task 2: Room management with tests (TDD)

In-memory room manager that tracks WebSocket connections per trip.

**Files:**
- Create: `apps/api/src/ws/rooms.ts`
- Create: `apps/api/src/__tests__/ws/rooms.test.ts`

**Step 1: Write failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PresenceUser } from "../../ws/types";
import { broadcastToTrip, getPresence, joinRoom, leaveRoom } from "../../ws/rooms";

// Minimal mock for WSContext
function createMockWs() {
  return { send: vi.fn(), close: vi.fn() };
}

describe("Room management", () => {
  beforeEach(() => {
    // Clear all rooms between tests
    leaveAll();
  });

  describe("joinRoom / leaveRoom", () => {
    it("adds user to room and returns presence list", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);

      const presence = getPresence("trip-1");
      expect(presence).toEqual([user]);
    });

    it("removes user from room on leave", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      leaveRoom("trip-1", ws);

      expect(getPresence("trip-1")).toEqual([]);
    });

    it("cleans up empty rooms", () => {
      const ws = createMockWs();
      const user: PresenceUser = { userId: "u1", name: "Alice", dayId: null, patternId: null };

      joinRoom("trip-1", ws, user);
      leaveRoom("trip-1", ws);

      // Room should be removed entirely
      expect(getPresence("trip-1")).toEqual([]);
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

      broadcastToTrip("trip-1", "u1", { type: "spot:deleted", dayId: "d1", patternId: "p1", spotId: "s1" });

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(ws2.send.mock.calls[0][0]);
      expect(sent.type).toBe("spot:deleted");
    });

    it("does nothing for non-existent room", () => {
      broadcastToTrip("no-room", "u1", { type: "spot:deleted", dayId: "d1", patternId: "p1", spotId: "s1" });
      // No error thrown
    });
  });

  describe("broadcastPresence", () => {
    it("sends presence list to all members in room", () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      const user1: PresenceUser = { userId: "u1", name: "Alice", dayId: "d1", patternId: null };
      const user2: PresenceUser = { userId: "u2", name: "Bob", dayId: null, patternId: null };

      joinRoom("trip-1", ws1, user1);
      joinRoom("trip-1", ws2, user2);

      broadcastPresence("trip-1");

      // Both users receive the presence list
      expect(ws1.send).toHaveBeenCalledOnce();
      expect(ws2.send).toHaveBeenCalledOnce();
      const sent = JSON.parse(ws1.send.mock.calls[0][0]);
      expect(sent.type).toBe("presence");
      expect(sent.users).toHaveLength(2);
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
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun run --filter @tabi/api test -- --run src/__tests__/ws/rooms.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement rooms.ts**

```ts
import type { PresenceUser, ServerMessage } from "./types";

// Minimal interface for WebSocket send/close (testable without real WS)
export type WsLike = {
  send: (data: string) => void;
  close: (...args: unknown[]) => void;
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

export function getPresence(tripId: string): PresenceUser[] {
  const room = rooms.get(tripId);
  if (!room) return [];
  return [...room.values()];
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
```

**Step 4: Run tests to verify they pass**

Run: `bun run --filter @tabi/api test -- --run src/__tests__/ws/rooms.test.ts`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```
feat: WebSocketルーム管理を追加
```

---

## Task 3: WebSocket handler

WebSocket upgrade endpoint with session auth and trip membership check.

**Files:**
- Create: `apps/api/src/ws/handler.ts`
- Modify: `apps/api/src/index.ts`

**Step 1: Create handler**

Uses `createBunWebSocket` from `hono/bun`. Auth is done in the callback factory (has access to Hono context `c`). On open, join room and broadcast presence. On close, leave room and broadcast presence. On message, handle `presence:update`.

```ts
import { createBunWebSocket } from "hono/bun";
import type { Hono } from "hono";
import { auth } from "../lib/auth";
import { checkTripAccess } from "../lib/permissions";
import type { ClientMessage } from "./types";
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
            const msg: ClientMessage = JSON.parse(
              typeof evt.data === "string" ? evt.data : "",
            );
            if (msg.type === "presence:update") {
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
```

**Step 2: Update index.ts to register WebSocket**

Change `apps/api/src/index.ts` from:

```ts
import { app } from "./app";

const port = Number(process.env.PORT) || 3001;

console.log(`API server running on http://localhost:${port}`);

export default {
  fetch: app.fetch,
  port,
};
```

To:

```ts
import { app } from "./app";
import { registerWebSocket, websocket } from "./ws/handler";

registerWebSocket(app);

const port = Number(process.env.PORT) || 3001;

console.log(`API server running on http://localhost:${port}`);

export default {
  fetch: app.fetch,
  port,
  websocket,
};
```

**Step 3: Verify types compile**

Run: `bun run --filter @tabi/api check-types`
Expected: PASS

**Step 4: Commit**

```
feat: WebSocketハンドラを追加
```

---

## Task 4: Add broadcast to spot routes

Call `broadcastToTrip` after each successful spot mutation.

**Files:**
- Modify: `apps/api/src/routes/spots.ts`

**Step 1: Add import and broadcast calls**

Add to top of file:
```ts
import { broadcastToTrip } from "../ws/rooms";
```

Add broadcast after each successful response (before `return`):

1. **POST (create spot)** -- after line 104, before `return c.json(spot, 201)`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "spot:created",
    dayId,
    patternId,
    spot,
  });
```

2. **PATCH (reorder)** -- after line 141, before `return c.json({ ok: true })`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "spot:reordered",
    dayId,
    patternId,
    spotIds: parsed.data.spotIds,
  });
```

3. **PATCH (update spot)** -- after line 183, before `return c.json(updated)`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "spot:updated",
    dayId,
    patternId,
    spot: updated,
  });
```

4. **DELETE (delete spot)** -- after line 208, before `return c.json({ ok: true })`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "spot:deleted",
    dayId,
    patternId,
    spotId,
  });
```

**Step 2: Verify types and existing tests pass**

Run: `bun run --filter @tabi/api check-types && bun run --filter @tabi/api test`
Expected: PASS

**Step 3: Commit**

```
feat: スポット変更時にWebSocketブロードキャストを追加
```

---

## Task 5: Add broadcast to pattern routes

Call `broadcastToTrip` after each successful pattern mutation.

**Files:**
- Modify: `apps/api/src/routes/patterns.ts`

**Step 1: Add import and broadcast calls**

Add to top of file:
```ts
import { broadcastToTrip } from "../ws/rooms";
```

Add broadcast after each successful response:

1. **POST (create)** -- before `return c.json(pattern, 201)`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "pattern:created",
    dayId,
    pattern: { ...pattern, spots: [] },
  });
```

2. **PATCH (update)** -- before `return c.json(updated)`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "pattern:updated",
    dayId,
    pattern: { ...updated, spots: [] },
  });
```

3. **DELETE** -- before `return c.json({ ok: true })`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "pattern:deleted",
    dayId,
    patternId,
  });
```

4. **POST duplicate** -- before `return c.json(result, 201)`:
```ts
  broadcastToTrip(tripId, user.id, {
    type: "pattern:duplicated",
    dayId,
    pattern: { ...result, spots: [] },
  });
```

**Step 2: Verify types and existing tests pass**

Run: `bun run --filter @tabi/api check-types && bun run --filter @tabi/api test`
Expected: PASS

**Step 3: Commit**

```
feat: パターン変更時にWebSocketブロードキャストを追加
```

---

## Task 6: Add broadcast to trip PATCH route

**Files:**
- Modify: `apps/api/src/routes/trips.ts`

**Step 1: Add import and broadcast calls**

Add to top of file:
```ts
import { broadcastToTrip } from "../ws/rooms";
```

Trip PATCH has two return paths (with/without date changes). Add broadcast before each successful return:

1. **Without date changes (line ~195)** -- before `return c.json(updated)`:
```ts
  broadcastToTrip(tripId, user.id, { type: "trip:updated", trip: updated });
```

Note: `trip:updated` sends partial trip data (no days). The client will `fetchTrip()` to get the full response.

2. **With date changes (line ~302)** -- before `return c.json(updated)`:
```ts
  broadcastToTrip(tripId, user.id, { type: "trip:updated", trip: updated });
```

**Step 2: Verify types and existing tests pass**

Run: `bun run --filter @tabi/api check-types && bun run --filter @tabi/api test`
Expected: PASS

**Step 3: Commit**

```
feat: 旅行更新時にWebSocketブロードキャストを追加
```

---

## Task 7: Client hook useTripSync (TDD)

Custom React hook for WebSocket connection, data sync, and presence.

**Files:**
- Create: `apps/web/lib/hooks/use-trip-sync.ts`

**Step 1: Implement the hook**

```ts
import { useCallback, useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "./use-online-status";

export type PresenceUser = {
  userId: string;
  name: string;
  dayId: string | null;
  patternId: string | null;
};

type ServerMessage =
  | { type: "presence"; users: PresenceUser[] }
  | { type: string };

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(
  /^http/,
  "ws",
);

const MAX_RECONNECT_DELAY = 30000;

export function useTripSync(
  tripId: string,
  onSync: () => void,
): {
  presence: PresenceUser[];
  isConnected: boolean;
  updatePresence: (dayId: string, patternId: string | null) => void;
} {
  const online = useOnlineStatus();
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to always call latest onSync without re-triggering effect
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const connect = useCallback(() => {
    if (wsRef.current) return;

    const ws = new WebSocket(`${WS_BASE}/ws/trips/${tripId}`);

    ws.onopen = () => {
      setIsConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (evt) => {
      try {
        const msg: ServerMessage = JSON.parse(evt.data);
        if (msg.type === "presence") {
          setPresence(msg.users);
        } else {
          // Any data change -> re-fetch trip
          onSyncRef.current();
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setIsConnected(false);
      setPresence([]);

      // Schedule reconnect with exponential backoff
      if (online) {
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
          connect();
        }, reconnectDelay.current);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [tripId, online]);

  useEffect(() => {
    if (!online) {
      wsRef.current?.close();
      return;
    }

    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, online]);

  const updatePresence = useCallback(
    (dayId: string, patternId: string | null) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "presence:update", dayId, patternId }));
      }
    },
    [],
  );

  return { presence, isConnected, updatePresence };
}
```

**Step 2: Verify types compile**

Run: `bun run --filter @tabi/web check-types`
Expected: PASS

**Step 3: Commit**

```
feat: useTripSync WebSocketフックを追加
```

---

## Task 8: Presence avatars component

Display connected members as circular initial badges.

**Files:**
- Create: `apps/web/components/presence-avatars.tsx`

**Step 1: Implement component**

```tsx
import type { PresenceUser } from "@/lib/hooks/use-trip-sync";
import { cn } from "@/lib/utils";

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
];

function hashColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitial(name: string): string {
  return (name[0] ?? "?").toUpperCase();
}

const MAX_VISIBLE = 2;

type PresenceAvatarsProps = {
  users: PresenceUser[];
  isConnected: boolean;
};

export function PresenceAvatars({ users, isConnected }: PresenceAvatarsProps) {
  if (users.length === 0 && isConnected) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1">
      {!isConnected && (
        <span className="text-xs text-muted-foreground" title="再接続中...">
          &#x26A0;
        </span>
      )}
      {visible.map((user) => (
        <span
          key={user.userId}
          title={user.name}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white",
            hashColor(user.userId),
          )}
        >
          {getInitial(user.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  );
}
```

**Step 2: Verify types compile**

Run: `bun run --filter @tabi/web check-types`
Expected: PASS

**Step 3: Commit**

```
feat: プレゼンスアバターコンポーネントを追加
```

---

## Task 9: Integrate into trip detail page

Wire up `useTripSync` and `PresenceAvatars` in the trip detail page. Add presence dots on day tabs.

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

**Step 1: Add imports**

```ts
import { PresenceAvatars } from "@/components/presence-avatars";
import { useTripSync } from "@/lib/hooks/use-trip-sync";
```

**Step 2: Add hook after existing state declarations (around line 43)**

```ts
const { presence, isConnected, updatePresence } = useTripSync(tripId, fetchTrip);
```

**Step 3: Send presence update when selected day/pattern changes**

Add a `useEffect` after the hook:

```ts
useEffect(() => {
  if (!currentDay) return;
  updatePresence(currentDay.id, currentPattern?.id ?? null);
}, [currentDay?.id, currentPattern?.id, updatePresence]);
```

Note: `currentDay` and `currentPattern` are computed from state on line 64-66. The `useEffect` must be placed after these computations but before the early returns (loading/error).

However, since hooks cannot be called conditionally, place this right after the `useTripSync` call (around line 44) with null checks inside:

```ts
const selectedDayId = trip?.days[selectedDay]?.id ?? null;
const selectedPatternId = trip?.days[selectedDay]?.patterns[selectedPattern[selectedDayId ?? ""] ?? 0]?.id ?? null;

useEffect(() => {
  if (selectedDayId) {
    updatePresence(selectedDayId, selectedPatternId);
  }
}, [selectedDayId, selectedPatternId, updatePresence]);
```

**Step 4: Add PresenceAvatars to header**

In the header section (around line 166-171), add avatars next to the trip title:

```tsx
<div className="mb-6">
  <div className="flex items-center gap-3">
    <h1 className="text-2xl font-bold">{trip.title}</h1>
    <PresenceAvatars users={presence} isConnected={isConnected} />
  </div>
  {/* ... rest of header unchanged */}
</div>
```

**Step 5: Add presence dots on day tabs**

In the day tab buttons (around line 193-210), add colored dots for users viewing each day. After `{day.dayNumber}日目`, add:

```tsx
{presence.some((u) => u.dayId === day.id) && (
  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
)}
```

Ensure the tab button has `relative` in its className (already present on line 202).

**Step 6: Verify types compile**

Run: `bun run --filter @tabi/web check-types`
Expected: PASS

**Step 7: Commit**

```
feat: 旅行詳細ページにリアルタイム同期とプレゼンスを統合
```

---

## Task 10: Lint and format

**Step 1: Run check on all packages**

Run: `bun run check`
Expected: PASS (or auto-fixed)

Run: `bun run check-types`
Expected: PASS

**Step 2: Run all unit tests**

Run: `bun run test`
Expected: All tests PASS

**Step 3: Commit any formatting fixes**

```
chore: lint/format修正
```

---

## Task 11: Manual testing checklist

Test with two browser windows open to the same trip:

1. [ ] Both windows connect (no console errors)
2. [ ] PresenceAvatars shows the other user
3. [ ] Adding a spot in window A appears in window B after a moment
4. [ ] Editing a spot in window A updates in window B
5. [ ] Deleting a spot in window A removes it in window B
6. [ ] Reordering spots in window A updates in window B
7. [ ] Adding a pattern in window A appears in window B
8. [ ] Switching day tabs shows presence dot on the correct tab
9. [ ] Closing window A removes avatar from window B
10. [ ] Disconnecting network shows warning icon, reconnects on restore
