import { useCallback, useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "./use-online-status";

export type PresenceUser = {
  userId: string;
  name: string;
  dayId: string | null;
  patternId: string | null;
};

type PresenceMessage = { type: "presence"; users: PresenceUser[] };

type SyncType =
  | "spot:created"
  | "spot:updated"
  | "spot:deleted"
  | "spot:reordered"
  | "pattern:created"
  | "pattern:updated"
  | "pattern:deleted"
  | "pattern:duplicated"
  | "trip:updated";

const SYNC_TYPES: Set<string> = new Set<SyncType>([
  "spot:created",
  "spot:updated",
  "spot:deleted",
  "spot:reordered",
  "pattern:created",
  "pattern:updated",
  "pattern:deleted",
  "pattern:duplicated",
  "trip:updated",
]);

type ServerMessage = PresenceMessage | { type: SyncType };

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/^http/, "ws");

const MAX_RECONNECT_DELAY = 30000;
const SYNC_DEBOUNCE_MS = 300;

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
  // Track whether we've ever attempted a connection (avoids warning flash on mount)
  const hasConnectedOnce = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const onlineRef = useRef(online);
  onlineRef.current = online;
  // Prevents onclose from scheduling reconnects after effect cleanup
  const disposedRef = useRef(false);

  const debouncedSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      onSyncRef.current();
    }, SYNC_DEBOUNCE_MS);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current || disposedRef.current) return;

    const ws = new WebSocket(`${WS_BASE}/ws/trips/${tripId}`);

    ws.onopen = () => {
      hasConnectedOnce.current = true;
      setIsConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (evt) => {
      try {
        const msg: ServerMessage = JSON.parse(evt.data);
        if (msg.type === "presence") {
          setPresence(msg.users);
        } else if (SYNC_TYPES.has(msg.type)) {
          debouncedSync();
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setIsConnected(false);
      setPresence([]);

      if (disposedRef.current || !onlineRef.current) return;

      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [tripId, debouncedSync]);

  useEffect(() => {
    disposedRef.current = false;

    if (!online) {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        ws.close();
      }
      return;
    }

    connect();

    return () => {
      disposedRef.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect, online]);

  const updatePresence = useCallback((dayId: string, patternId: string | null) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "presence:update", dayId, patternId }));
    }
  }, []);

  return { presence, isConnected: isConnected || !hasConnectedOnce.current, updatePresence };
}
