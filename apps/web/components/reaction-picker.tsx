import { haptics } from "@/lib/haptics";
import { REACTION_EMOJIS } from "@/lib/hooks/use-reaction";
import { cn } from "@/lib/utils";

export function ReactionPicker({
  onSelect,
  cooldown,
}: {
  onSelect: (emoji: string) => void;
  cooldown: boolean;
}) {
  return (
    <div className="flex gap-1">
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={emoji}
          disabled={cooldown}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-transform hover:scale-110 active:scale-95",
            cooldown && "opacity-50",
          )}
          onClick={() => {
            haptics.light();
            onSelect(emoji);
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
