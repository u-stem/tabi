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
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

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
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[Realtime] Channel subscription failed: ${status}`);
          toast.error(MSG.REALTIME_CONNECTION_FAILED);
        }
      });

    channelRef.current = channel;

    return () => {
      if (syncTimer.current) {
        clearTimeout(syncTimer.current);
        syncTimer.current = null;
      }
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
      setPresence([]);
    };
  }, [tripId, debouncedSync]);

  const updatePresence = useCallback(
    (dayId: string, patternId: string | null) => {
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
