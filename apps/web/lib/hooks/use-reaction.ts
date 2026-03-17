import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "😍", "🔥", "👏", "😮"] as const;

const MAX_ACTIVE_REACTIONS = 20;
const COOLDOWN_MS = 1000;

type ReactionEvent = {
  emoji: string;
  userId: string;
  name: string;
  image?: string;
  color: string;
};

export type FloatingReaction = {
  id: string;
  emoji: string;
  name: string;
  image?: string;
  color: string;
  x: number;
};

type ReactionUser = {
  id: string;
  name: string;
  image?: string;
  color: string;
};

export function useReaction(
  channel: RealtimeChannel | null,
  user: ReactionUser | null,
): {
  reactions: FloatingReaction[];
  sendReaction: (emoji: string) => void;
  removeReaction: (id: string) => void;
  cooldown: boolean;
} {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [cooldown, setCooldown] = useState(false);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  const addReaction = useCallback((event: ReactionEvent) => {
    const floating: FloatingReaction = {
      id: crypto.randomUUID(),
      emoji: event.emoji,
      name: event.name,
      image: event.image,
      color: event.color,
      x: Math.floor(Math.random() * 81) + 10, // 10-90
    };
    setReactions((prev) => {
      const next = [...prev, floating];
      return next.length > MAX_ACTIVE_REACTIONS ? next.slice(-MAX_ACTIVE_REACTIONS) : next;
    });
  }, []);

  useEffect(() => {
    if (!channel) return;

    channel.on("broadcast", { event: "trip:reaction" }, (msg: { payload: ReactionEvent }) => {
      addReaction(msg.payload);
    });
  }, [channel, addReaction]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (cooldown || !channel || !userRef.current) return;

      const payload: ReactionEvent = {
        emoji,
        userId: userRef.current.id,
        name: userRef.current.name,
        image: userRef.current.image,
        color: userRef.current.color,
      };

      channel.send({
        type: "broadcast",
        event: "trip:reaction",
        payload,
      });

      // Show on own screen (Supabase broadcast does not echo to sender by default)
      addReaction(payload);

      setCooldown(true);
      cooldownTimer.current = setTimeout(() => {
        setCooldown(false);
        cooldownTimer.current = null;
      }, COOLDOWN_MS);
    },
    [cooldown, channel, addReaction],
  );

  const removeReaction = useCallback((id: string) => {
    setReactions((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearTimeout(cooldownTimer.current);
      }
    };
  }, []);

  return { reactions, sendReaction, removeReaction, cooldown };
}
