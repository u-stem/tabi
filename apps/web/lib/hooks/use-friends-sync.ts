import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "../supabase";

const SYNC_DEBOUNCE_MS = 300;
const SYNC_JITTER_MS = 200;

// Track active subscription channels so broadcastFriendsUpdate
// can send directly instead of creating a temporary channel.
const activeChannels = new Map<string, RealtimeChannel>();

export function useFriendsSync(userId: string | undefined, onSync: () => void): void {
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
    if (!userId) return;

    const channelName = `friends:${userId}`;

    function connect() {
      disconnect();
      // SECURITY: Supabase Realtime channels are accessible to anyone with the anon key.
      // userId is a UUIDv4 (122-bit entropy), making brute-force impractical.
      const channel = supabase.channel(channelName);

      channel
        .on("broadcast", { event: "friends:updated" }, () => {
          debouncedSync();
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.debug(`[FriendsSync] ${status} — SDK will auto-rejoin`);
          }
          if (status === "CLOSED" && channelRef.current === channel) {
            console.warn("[FriendsSync] Channel closed, recreating");
            connect();
          }
        });

      channelRef.current = channel;
      activeChannels.set(channelName, channel);
    }

    function disconnect() {
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        activeChannels.delete(channelName);
        supabase.removeChannel(channel);
      }
    }

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
    };
  }, [userId, debouncedSync]);
}

/**
 * Notify a target user that their friends data has changed.
 * If we're already subscribed to their channel, send directly;
 * otherwise create a temporary channel, send, and clean up.
 */
export function broadcastFriendsUpdate(targetUserId: string): void {
  const channelName = `friends:${targetUserId}`;
  const payload = { type: "broadcast" as const, event: "friends:updated", payload: {} };

  const existing = activeChannels.get(channelName);
  if (existing) {
    existing.send(payload);
    return;
  }

  let cleaned = false;
  const temp = supabase.channel(channelName);
  const cleanupTemp = () => {
    if (cleaned) return;
    cleaned = true;
    supabase.removeChannel(temp);
  };
  temp.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      temp.send(payload);
      setTimeout(cleanupTemp, 500);
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      cleanupTemp();
    }
  });
}
