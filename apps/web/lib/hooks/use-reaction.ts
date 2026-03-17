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

export type ReactionUser = {
  id: string;
  name: string;
  image?: string;
  color: string;
};

export function buildReactionUser(session: {
  user: { id: string; name: string; image?: string | null };
}): ReactionUser {
  return {
    id: session.user.id,
    name: session.user.name,
    image: session.user.image ?? undefined,
    color: hashColorForReaction(session.user.id),
  };
}

// Inline hash to avoid circular dependency with presence-avatars
function hashColorForReaction(userId: string): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-cyan-500",
    "bg-orange-500",
    "bg-teal-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-lime-500",
    "bg-fuchsia-500",
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

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
  const cooldownRef = useRef(false);
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
    // Supabase SDK does not expose off() for broadcast handlers.
    // Cleanup is unnecessary because the channel itself is removed
    // and recreated by useTripSync on reconnection.
    channel.on("broadcast", { event: "trip:reaction" }, (msg: { payload: ReactionEvent }) => {
      addReaction(msg.payload);
    });
  }, [channel, addReaction]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (cooldownRef.current || !channel || !userRef.current) return;

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

      cooldownRef.current = true;
      setCooldown(true);
      cooldownTimer.current = setTimeout(() => {
        cooldownRef.current = false;
        setCooldown(false);
        cooldownTimer.current = null;
      }, COOLDOWN_MS);
    },
    [channel, addReaction],
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
