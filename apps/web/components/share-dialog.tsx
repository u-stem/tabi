"use client";

import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { copyToClipboard } from "@/lib/clipboard";
import { formatDateFromISO } from "@/lib/format";
import { MSG } from "@/lib/messages";

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  expiresAt: string | null;
};

export function ShareDialog({ open, onOpenChange, shareUrl, expiresAt }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(shareUrl);
      setCopied(true);
      toast.success(MSG.SHARE_LINK_COPIED);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(MSG.COPY_FAILED);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>共有リンク</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            URLまたはQRコードで旅行プランを共有できます
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-md border bg-muted px-3 py-2 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={handleCopy}
              aria-label={copied ? "コピー完了" : "URLをコピー"}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex justify-center rounded-md border bg-white p-4">
            <QRCodeSVG value={shareUrl} size={200} level="M" />
          </div>

          {expiresAt && (
            <p className="text-center text-xs text-muted-foreground">
              有効期限:{" "}
              {new Date(expiresAt) < new Date() ? "期限切れ" : formatDateFromISO(expiresAt)}
            </p>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
