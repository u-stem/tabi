import type { PresenceUser } from "@/lib/hooks/use-trip-sync";
import { cn } from "@/lib/utils";

const COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-cyan-500",
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
};

export function PresenceAvatars({ users, isConnected }: PresenceAvatarsProps) {
  if (users.length === 0 && isConnected) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-1">
      {!isConnected && (
        <span className="text-xs text-muted-foreground" title="再接続中...">
          &#x26A0;
        </span>
      )}
      {visible.map((user) => (
        <span
          key={user.userId}
          title={user.name}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white",
            hashColor(user.userId),
          )}
        >
          {getInitial(user.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          +{overflow}
        </span>
      )}
    </div>
  );
}
