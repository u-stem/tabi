"use client";

import { Download, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";

const QR_SIZE = 200;
const QR_PADDING = 16;
const EXPORT_SCALE = 3;

interface MyQrDialogProps {
  userId: string;
}

export function MyQrDialog({ userId }: MyQrDialogProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/friends/add?userId=${encodeURIComponent(userId)}`
      : `/friends/add?userId=${encodeURIComponent(userId)}`;

  const handleDownload = useCallback(() => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const totalSize = (QR_SIZE + QR_PADDING * 2) * EXPORT_SCALE;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = totalSize;
      canvas.height = totalSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, totalSize, totalSize);

      // Draw QR code centered with padding
      ctx.drawImage(
        img,
        QR_PADDING * EXPORT_SCALE,
        QR_PADDING * EXPORT_SCALE,
        QR_SIZE * EXPORT_SCALE,
        QR_SIZE * EXPORT_SCALE,
      );

      const a = document.createElement("a");
      a.download = "sugara-qr.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
    };

    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
  }, []);

  return (
    <ResponsiveDialog>
      <ResponsiveDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap rounded-full">
          <QrCode className="h-3.5 w-3.5" />
          QRコード
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className="sm:max-w-xs">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>フレンド追加用QRコード</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div ref={qrRef} className="rounded-lg border bg-white p-4 dark:border-0 dark:shadow-sm">
            <QRCodeSVG value={url} size={QR_SIZE} level="M" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            相手がスキャンすると
            <br />
            あなたにフレンド申請を送れます
          </p>
        </div>
        <ResponsiveDialogFooter className="[&>*]:flex-1">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-1 h-4 w-4" />
            画像を保存
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
