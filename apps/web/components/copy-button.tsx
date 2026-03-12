"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  successMessage?: string;
  label?: string;
  className?: string;
}

export function CopyButton({
  value,
  successMessage = MSG.SHARE_LINK_COPIED,
  label = "コピー",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(MSG.COPY_FAILED);
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("shrink-0 relative", className)}
      onClick={handleCopy}
      aria-label={copied ? "コピー完了" : label}
    >
      <Copy
        className={cn(
          "h-4 w-4 transition-all duration-200",
          copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <Check
        className={cn(
          "absolute h-4 w-4 text-green-500 transition-all duration-200",
          copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
        )}
      />
    </Button>
  );
}
