# Collaborative Editing Design

## Goal

Enable real-time collaboration on trip detail pages. When one member adds, edits, or deletes spots/patterns, other members viewing the same trip see the changes immediately. Show presence indicators so members know who else is viewing the trip.

## Decisions

| Topic | Choice | Rationale |
|-------|--------|-----------|
| Scope | Live sync + presence | Full CRDT is overkill for a planning app |
| Transport | WebSocket | Bidirectional; Hono + bun native support |
| Conflict resolution | Last-write-wins | Main operations are add/delete/reorder, not concurrent text editing |
| Sync target | Trip detail page only | Trip list refreshes on navigation |

## Architecture

```
Browser A                 API Server                Browser B
   |                         |                         |
   |-- REST: create spot --> |                         |
   |<-- 201 OK ------------ |                         |
   |                         |-- WS: spot:created ---> |
   |                         |                         |--> fetchTrip()
```

REST API handles all writes and persistence. On success, the route broadcasts a WebSocket message to all room members except the sender. The receiver calls `fetchTrip()` to reload data.

### Connection Flow

1. User opens `/trips/:id`
2. Client connects to `ws://<host>/ws/trips/:tripId`
3. Server validates session cookie and trip membership
4. Auth OK: join room, broadcast presence
5. Auth fail: close with code 4401 (unauthorized) or 4403 (not a member)
6. On disconnect: leave room, broadcast presence

### Room Management

In-memory `Map<tripId, Map<ws, PresenceUser>>`. No external store needed for a single-process server. Clients reconnect automatically on server restart.

## WebSocket Protocol

All messages are JSON.

### Server to Client

```ts
type ServerMessage =
  | { type: "spot:created"; dayId: string; patternId: string; spot: SpotResponse }
  | { type: "spot:updated"; dayId: string; patternId: string; spot: SpotResponse }
  | { type: "spot:deleted"; dayId: string; patternId: string; spotId: string }
  | { type: "spot:reordered"; dayId: string; patternId: string; spotIds: string[] }
  | { type: "pattern:created"; dayId: string; pattern: DayPatternResponse }
  | { type: "pattern:updated"; dayId: string; pattern: DayPatternResponse }
  | { type: "pattern:deleted"; dayId: string; patternId: string }
  | { type: "pattern:duplicated"; dayId: string; pattern: DayPatternResponse }
  | { type: "trip:updated" }
  | { type: "presence"; users: PresenceUser[] }
```

### Client to Server

```ts
type ClientMessage =
  | { type: "presence:update"; dayId: string; patternId: string | null }
```

Only presence updates go upstream. Data mutations use REST.

### Presence

```ts
type PresenceUser = {
  userId: string;
  name: string;
  dayId: string | null;
  patternId: string | null;
}
```

## Server Implementation

### New Files

- `apps/api/src/ws/rooms.ts` -- Room management and broadcast
- `apps/api/src/ws/handler.ts` -- WebSocket upgrade, auth, join/leave
- `apps/api/src/ws/types.ts` -- Message type definitions

### Changes to Existing Files

- `apps/api/src/app.ts` -- Register WebSocket handler
- `apps/api/src/routes/spots.ts` -- Add `broadcastToTrip` call after each mutation (5 places)
- `apps/api/src/routes/patterns.ts` -- Add `broadcastToTrip` call after each mutation (4 places)
- `apps/api/src/routes/trips.ts` -- Add `broadcastToTrip` call after PATCH (1 place)

Each route change is a single line: `broadcastToTrip(tripId, userId, { type: "...", ... })`.

## Client Implementation

### New Files

- `apps/web/lib/hooks/use-trip-sync.ts` -- WebSocket connection, presence, reconnect
- `apps/web/components/presence-avatars.tsx` -- Avatar list component

### Hook API

```ts
function useTripSync(tripId: string, onSync: () => void): {
  presence: PresenceUser[];
  isConnected: boolean;
  updatePresence: (dayId: string, patternId: string | null) => void;
}
```

### Data Update Strategy

On receiving any data message, call `fetchTrip()` to reload the full trip. No partial/diff application.

Reasons:
- Reuses existing `fetchTrip` with no new code
- Trip data is small (tens of spots)
- Can move to diff-based updates later if needed

### Reconnection

Exponential backoff: 1s, 2s, 4s, ... up to 30s. Pause when offline (respects `useOnlineStatus`).

## Presence UI

### Avatars

Display connected members (excluding self) as circular badges with name initials, to the right of the trip title. Color derived from userId hash (6-color palette). Tooltip shows full name. Collapse to `+N` after 2 avatars.

### Day Indicator

Show colored dots on day tabs matching avatar colors, indicating which day each member is viewing.

### Connection Status

Show a small warning icon next to avatars when WebSocket is disconnected.

## Testing

- `apps/api/src/__tests__/ws/rooms.test.ts` -- Room join/leave/broadcast logic
- `apps/api/src/__tests__/ws/handler.test.ts` -- Auth rejection (unauthenticated, non-member)
- Integration test for broadcast after spot creation (WebSocket client in test)
- `useTripSync` hook test deferred (WebSocket mock complexity)

## Type Sharing

Message types start in `apps/api/src/ws/types.ts`. Client duplicates types in the hook file. Move to `packages/shared` once the protocol stabilizes.
