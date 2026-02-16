import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MSG } from "../messages";
import { supabase } from "../supabase";

export type PresenceUser = {
  userId: string;
  name: string;
  dayId: string | null;
  patternId: string | null;
};

const SYNC_DEBOUNCE_MS = 300;
const SYNC_JITTER_MS = 200;
const RETRY_MAX = 5;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 10_000;

export function useTripSync(
  tripId: string,
  user: { id: string; name: string } | null,
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
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
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
      // Cleanup existing channel and pending retry to prevent duplicates
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
            retryCount.current = 0;
            toast.dismiss("realtime-error");
            const u = userRef.current;
            const lp = lastPresenceRef.current;
            if (u && lp) {
              channel.track({ userId: u.id, name: u.name, ...lp });
            }
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (retryCount.current < RETRY_MAX) {
              console.debug(
                `[Realtime] Retry ${retryCount.current + 1}/${RETRY_MAX} after ${status}`,
              );
              const base = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** retryCount.current);
              // Equal Jitter: delay = base * [0.5, 1.0)
              const delay = base * (0.5 + Math.random() * 0.5);
              retryCount.current += 1;
              retryTimer.current = setTimeout(() => {
                retryTimer.current = null;
                connect();
              }, delay);
            } else {
              console.error(`[Realtime] All retries exhausted after ${status}`);
              toast.error(MSG.REALTIME_CONNECTION_FAILED, { id: "realtime-error" });
            }
          }
        });

      channelRef.current = channel;
    }

    function disconnect() {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      const channel = channelRef.current;
      if (channel) {
        supabase.removeChannel(channel);
      }
      channelRef.current = null;
      setIsConnected(false);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        disconnect();
      } else {
        retryCount.current = 0;
        connect();
        onSyncRef.current();
      }
    }

    function handleOnline() {
      retryCount.current = 0;
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

  const updatePresence = useCallback(
    (dayId: string, patternId: string | null) => {
      lastPresenceRef.current = { dayId, patternId };
      if (!user) return;
      channelRef.current?.track({
        userId: user.id,
        name: user.name,
        dayId,
        patternId,
      });
    },
    [user],
  );

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
