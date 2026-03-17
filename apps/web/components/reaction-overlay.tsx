import type { FloatingReaction } from "@/lib/hooks/use-reaction";
import { cn } from "@/lib/utils";

function getInitial(name: string): string {
  return (name[0] ?? "?").toUpperCase();
}

export function ReactionOverlay({
  reactions,
  onAnimationEnd,
}: {
  reactions: FloatingReaction[];
  onAnimationEnd: (id: string) => void;
}) {
  return (
    <div
      data-testid="reaction-overlay"
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      {reactions.map((r) => (
        <div
          key={r.id}
          data-reaction-id={r.id}
          className="absolute flex flex-col items-center gap-0.5"
          style={{
            left: `${r.x}%`,
            bottom: "20vh",
            animation: "reaction-float-up 8s ease-out forwards",
          }}
          onAnimationEnd={() => onAnimationEnd(r.id)}
        >
          <span className="text-[28px] leading-none lg:text-[40px]">{r.emoji}</span>
          <span
            className={cn(
              "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-semibold text-white lg:h-[22px] lg:w-[22px] lg:text-[11px]",
              r.color,
            )}
          >
            {getInitial(r.name)}
          </span>
        </div>
      ))}
    </div>
  );
}
