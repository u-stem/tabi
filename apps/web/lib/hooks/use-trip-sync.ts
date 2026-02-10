import { useCallback, useEffect, useRef, useState } from "react";
import { useOnlineStatus } from "./use-online-status";

// Close a WebSocket safely regardless of its readyState.
// CONNECTING sockets cannot be closed without a browser warning,
// so we defer the close until the connection opens.
// All handlers are nulled to prevent zombie reconnections (e.g. Strict Mode).
function safeClose(ws: WebSocket): void {
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;
  if (ws.readyState === WebSocket.OPEN) {
    ws.close();
  } else if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close();
  }
}

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
  // While connecting (not yet open), suppress the disconnected warning
  const [isConnecting, setIsConnecting] = useState(false);
  // While waiting on reconnect backoff timer, suppress the disconnected warning
  const [isReconnecting, setIsReconnecting] = useState(false);
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
    setIsConnecting(true);
    setIsReconnecting(false);

    ws.onopen = () => {
      hasConnectedOnce.current = true;
      setIsConnecting(false);
      setIsConnected(true);
      reconnectDelay.current = 1000;
    };

    ws.onmessage = (evt) => {
      try {
        const msg: unknown = JSON.parse(evt.data);
        if (typeof msg !== "object" || msg === null || !("type" in msg)) return;
        const typed = msg as { type: string };
        if (typed.type === "ping") {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "pong" }));
          }
          return;
        }
        const serverMsg = typed as ServerMessage;
        if (serverMsg.type === "presence") {
          setPresence(serverMsg.users);
        } else if (SYNC_TYPES.has(serverMsg.type)) {
          debouncedSync();
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[WebSocket] Malformed message:", evt.data, err);
        }
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setIsConnecting(false);
      setIsConnected(false);
      setPresence([]);

      if (disposedRef.current || !onlineRef.current) return;

      setIsReconnecting(true);
      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(reconnectDelay.current * 2, MAX_RECONNECT_DELAY);
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      safeClose(ws);
    };

    wsRef.current = ws;
  }, [tripId, debouncedSync]);

  useEffect(() => {
    disposedRef.current = false;

    if (!online) {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
        setIsReconnecting(false);
      }
      const ws = wsRef.current;
      if (ws) {
        wsRef.current = null;
        safeClose(ws);
      }
      return;
    }

    connect();

    // Close WebSocket explicitly on tab/window close.
    // useEffect cleanup alone is not guaranteed to run when the browser terminates.
    const closeWs = () => {
      if (wsRef.current) safeClose(wsRef.current);
    };
    window.addEventListener("beforeunload", closeWs);
    window.addEventListener("pagehide", closeWs);

    return () => {
      disposedRef.current = true;
      window.removeEventListener("beforeunload", closeWs);
      window.removeEventListener("pagehide", closeWs);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      if (wsRef.current) safeClose(wsRef.current);
      wsRef.current = null;
    };
  }, [connect, online]);

  const updatePresence = useCallback((dayId: string, patternId: string | null) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "presence:update", dayId, patternId }));
    }
  }, []);

  // Suppress the disconnected warning during internal transient states:
  // - initial mount (hasConnectedOnce=false)
  // - WebSocket handshake in progress (isConnecting)
  // - reconnect backoff timer active (isReconnecting)
  // - browser offline (different UX concern, not a WS issue)
  const suppressWarning = !hasConnectedOnce.current || isConnecting || isReconnecting || !online;

  return {
    presence,
    isConnected: isConnected || suppressWarning,
    updatePresence,
  };
}
