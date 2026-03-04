"use client";

import { QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MyQrDialogProps {
  userId: string;
  userName: string;
}

export function MyQrDialog({ userId, userName }: MyQrDialogProps) {
  // window.location.origin is safe here because this is a Client Component
  // and only rendered in the browser
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/friends/add?userId=${userId}`
      : `/friends/add?userId=${userId}`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <QrCode className="h-3.5 w-3.5" />
          QRコード
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>フレンド追加用QRコード</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-lg border p-4 bg-white">
            <QRCodeSVG value={url} size={200} level="M" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            このQRコードをスキャンすると
            <br />
            {userName} さんにフレンド申請できます
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
