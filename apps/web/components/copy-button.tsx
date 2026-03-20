"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  successMessage?: string;
  label?: string;
  className?: string;
}

export function CopyButton({ value, successMessage, label, className }: CopyButtonProps) {
  const t = useTranslations("common");
  const tm = useTranslations("messages");
  const resolvedLabel = label ?? t("copy");
  const resolvedSuccessMessage = successMessage ?? tm("shareLinkCopied");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(value);
      setCopied(true);
      toast.success(resolvedSuccessMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tm("copyFailed"));
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className={cn("shrink-0 relative", className)}
      onClick={handleCopy}
      aria-label={copied ? t("copyDone") : resolvedLabel}
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
