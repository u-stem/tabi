"use client";

import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { CopyButton } from "@/components/copy-button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { formatDateFromISO } from "@/lib/format";

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  expiresAt: string | null;
  description?: string;
};

export function ShareDialog({
  open,
  onOpenChange,
  shareUrl,
  expiresAt,
  description,
}: ShareDialogProps) {
  const tt = useTranslations("trip");
  const resolvedDescription = description ?? tt("shareDescription");
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{tt("shareTitle")}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>{resolvedDescription}</ResponsiveDialogDescription>
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
            <CopyButton value={shareUrl} label={tt("copyUrl")} />
          </div>

          <div className="flex justify-center rounded-md border bg-white p-4 dark:border-0 dark:shadow-sm">
            <QRCodeSVG value={shareUrl} size={200} level="M" />
          </div>

          {expiresAt && (
            <p className="text-center text-xs text-muted-foreground">
              {tt("shareExpiry")}{" "}
              {new Date(expiresAt) < new Date() ? tt("expired") : formatDateFromISO(expiresAt)}
            </p>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
