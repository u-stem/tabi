import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";

type ReorderControlsProps = {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst: boolean;
  isLast: boolean;
};

export function ReorderControls({ onMoveUp, onMoveDown, isFirst, isLast }: ReorderControlsProps) {
  const tr = useTranslations("reorder");
  return (
    <div className="flex min-w-[44px] shrink-0 flex-col items-center justify-center">
      <button
        type="button"
        onClick={() => onMoveUp?.()}
        disabled={isFirst}
        className="flex flex-1 min-h-[33px] w-[44px] items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-transform lg:active:scale-[0.85]"
        aria-label={tr("moveUp")}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onMoveDown?.()}
        disabled={isLast}
        className="flex flex-1 min-h-[33px] w-[44px] items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-transform lg:active:scale-[0.85]"
        aria-label={tr("moveDown")}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}
