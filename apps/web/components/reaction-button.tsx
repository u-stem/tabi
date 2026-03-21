"use client";

import { SmilePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ReactionPicker } from "@/components/reaction-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { haptics } from "@/lib/haptics";

export function ReactionButton({
  onReaction,
  cooldown,
}: {
  onReaction: (emoji: string) => void;
  cooldown: boolean;
}) {
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={tc("reactionButton")}
          onClick={() => haptics.light()}
        >
          <SmilePlus className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center" sideOffset={8}>
        <ReactionPicker
          onSelect={(emoji) => {
            onReaction(emoji);
            setOpen(false);
          }}
          cooldown={cooldown}
        />
      </PopoverContent>
    </Popover>
  );
}
