"use client";

import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";

interface MyQrDialogProps {
  userId: string;
}

export function MyQrDialog({ userId }: MyQrDialogProps) {
  // window.location.origin is safe here because this is a Client Component
  // and only rendered in the browser
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/friends/add?userId=${encodeURIComponent(userId)}`
      : `/friends/add?userId=${encodeURIComponent(userId)}`;

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
          <QrCode className="h-3.5 w-3.5" />
          QRコード
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-xs">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>フレンド追加用QRコード</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-lg border bg-white p-4 dark:border-0 dark:shadow-sm">
            <QRCodeSVG value={url} size={200} level="M" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            相手がスキャンすると
            <br />
            あなたにフレンド申請を送れます
          </p>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
