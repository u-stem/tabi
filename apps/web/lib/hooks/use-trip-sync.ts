import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../supabase";

export type PresenceUser = {
  userId: string;
  name: string;
  image?: string | null;
  dayId: string | null;
  patternId: string | null;
};

const SYNC_DEBOUNCE_MS = 300;
const SYNC_JITTER_MS = 200;

export function useTripSync(
  tripId: string,
  user: { id: string; name: string; image?: string | null } | null,
  onSync: () => void,
): {
  presence: PresenceUser[];
  isConnected: boolean;
  updatePresence: (dayId: string, patternId: string | null) => void;
  broadcastChange: () => void;
} {
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const userRef = useRef(user);
  userRef.current = user;
  const lastPresenceRef = useRef<{ dayId: string; patternId: string | null } | null>(null);

  const debouncedSync = useCallback(() => {
    if (syncTimer.current) {
      clearTimeout(syncTimer.current);
    }
    const delay = SYNC_DEBOUNCE_MS + Math.floor(Math.random() * SYNC_JITTER_MS);
    syncTimer.current = setTimeout(() => {
      syncTimer.current = null;
      onSyncRef.current();
    }, delay);
  }, []);

  useEffect(() => {
    function connect() {
      disconnect();
      const channel = supabase.channel(`trip:${tripId}`);

      channel
        .on("broadcast", { event: "trip:updated" }, () => {
          debouncedSync();
        })
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState<PresenceUser>();
          const users: PresenceUser[] = [];
          const seen = new Set<string>();
          for (const key of Object.keys(state)) {
            for (const p of state[key]) {
              if (p.userId && !seen.has(p.userId)) {
                seen.add(p.userId);
                users.push({
                  userId: p.userId,
                  name: p.name,
                  image: p.image,
                  dayId: p.dayId,
                  patternId: p.patternId,
                });
              }
            }
          }
          setPresence(users);
        })
        .subscribe((status) => {
          setIsConnected(status === "SUBSCRIBED");
          if (status === "SUBSCRIBED") {
            toast.dismiss("realtime-error");
            const u = userRef.current;
            const lp = lastPresenceRef.current;
            if (u && lp) {
              channel.track({ userId: u.id, name: u.name, image: u.image, ...lp });
            }
          }
          // SDK's rejoinTimer handles TIMED_OUT / CHANNEL_ERROR automatically
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.debug(`[Realtime] ${status} — SDK will auto-rejoin`);
          }
          // CLOSED means SDK removed the channel; manual recovery needed
          if (status === "CLOSED" && channelRef.current === channel) {
            console.warn("[Realtime] Channel closed, recreating");
            connect();
          }
        });

      channelRef.current = channel;
    }

    function disconnect() {
      const channel = channelRef.current;
      // Clear ref before removeChannel to prevent re-entrant CLOSED handling
      channelRef.current = null;
      if (channel) {
        supabase.removeChannel(channel);
      }
      setIsConnected(false);
    }

    // worker: true keeps heartbeat alive in background tabs,
    // so we only refetch data on visibility restore (events may have been missed)
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        onSyncRef.current();
      }
    }

    function handleOnline() {
      connect();
      onSyncRef.current();
    }

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      disconnect();
      setPresence([]);
    };
  }, [tripId, debouncedSync]);

  const updatePresence = useCallback((dayId: string, patternId: string | null) => {
    lastPresenceRef.current = { dayId, patternId };
    const u = userRef.current;
    if (!u) return;
    channelRef.current?.track({
      userId: u.id,
      name: u.name,
      image: u.image,
      dayId,
      patternId,
    });
  }, []);

  const broadcastChange = useCallback(() => {
    channelRef.current?.send({
      type: "broadcast",
      event: "trip:updated",
      payload: {},
    });
  }, []);

  return {
    presence,
    isConnected,
    updatePresence,
    broadcastChange,
  };
}
