import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

export function useQuickPollSync(shareToken: string | null) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!shareToken) return;

    const channel = supabase.channel(`quick-poll:${shareToken}`);
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "poll:voted" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(shareToken) });
      })
      .on("broadcast", { event: "poll:closed" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.quickPolls.shared(shareToken) });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [shareToken, queryClient]);

  function broadcastVote() {
    channelRef.current?.send({ type: "broadcast", event: "poll:voted", payload: {} });
  }

  function broadcastClose() {
    channelRef.current?.send({ type: "broadcast", event: "poll:closed", payload: {} });
  }

  return { broadcastVote, broadcastClose };
}
