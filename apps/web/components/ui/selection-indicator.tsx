import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function SelectionIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary",
        checked && "bg-primary text-primary-foreground",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" />}
    </span>
  );
}
