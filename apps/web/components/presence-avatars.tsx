"use client";

import { useState } from "react";
import { ReactionPicker } from "@/components/reaction-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { PresenceUser } from "@/lib/hooks/use-trip-sync";
import { cn } from "@/lib/utils";

const COLORS = [
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

export function hashColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitial(name: string): string {
  return (name[0] ?? "?").toUpperCase();
}

const MAX_VISIBLE = 2;

type PresenceAvatarsProps = {
  users: PresenceUser[];
  isConnected: boolean;
  onReaction?: (emoji: string) => void;
  cooldown?: boolean;
};

function AvatarCircle({ user }: { user: PresenceUser }) {
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
      {user.image ? (
        <img src={user.image} alt={user.name} width={28} height={28} />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center text-xs font-medium text-white",
            hashColor(user.userId),
          )}
        >
          {getInitial(user.name)}
        </span>
      )}
    </span>
  );
}

function OverflowBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      +{count}
    </span>
  );
}

function DisconnectWarning() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-xs text-muted-foreground">&#x26A0;</span>
      </TooltipTrigger>
      <TooltipContent>再接続中...</TooltipContent>
    </Tooltip>
  );
}

export function PresenceAvatars({
  users,
  isConnected,
  onReaction,
  cooldown,
}: PresenceAvatarsProps) {
  const [open, setOpen] = useState(false);

  if (users.length === 0 && isConnected) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  // Reaction mode: Popover wraps avatar area
  if (onReaction) {
    return (
      <TooltipProvider>
        <div className="flex items-center gap-1">
          {!isConnected && <DisconnectWarning />}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1"
                aria-label="リアクションを送る"
              >
                {visible.map((user) => (
                  <AvatarCircle key={user.userId} user={user} />
                ))}
                <OverflowBadge count={overflow} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
              <ReactionPicker
                onSelect={(emoji) => {
                  onReaction(emoji);
                  setOpen(false);
                }}
                cooldown={cooldown ?? false}
              />
            </PopoverContent>
          </Popover>
        </div>
      </TooltipProvider>
    );
  }

  // Default mode: individual name tooltips (used in DayTabs etc.)
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {!isConnected && <DisconnectWarning />}
        {/* Uses hashColor instead of UserAvatar for stable per-user colors in presence */}
        {visible.map((user) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <AvatarCircle user={user} />
            </TooltipTrigger>
            <TooltipContent>{user.name}</TooltipContent>
          </Tooltip>
        ))}
        <OverflowBadge count={overflow} />
      </div>
    </TooltipProvider>
  );
}
