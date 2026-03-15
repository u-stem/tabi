"use client";

import { Html5Qrcode } from "html5-qrcode";
import { ImageIcon, ScanLine, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { parseQrFriendUrl } from "@/lib/qr-utils";

const READER_ID = "qr-reader";

function ImageUploadArea({
  fileInputRef,
  onFileChange,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-muted-foreground/50">
      <ImageIcon className="h-10 w-10 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">タップして画像を選択</span>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
    </label>
  );
}

export function QrScannerDialog() {
  const router = useRouter();
  const isMobile = useMobile();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(() => (isMobile ? "camera" : "image"));
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const processingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        const state = scanner.getState();
        // 2 = SCANNING, 3 = PAUSED
        if (state === 2 || state === 3) {
          await scanner.stop();
        }
      } catch {
        // already stopped
      }
    }
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      if (processingRef.current) return;
      const origin = window.location.origin;
      const userId = parseQrFriendUrl(decodedText, origin);
      if (userId) {
        processingRef.current = true;
        setError(null);
        await stopScanner();
        setOpen(false);
        router.push(`/friends/add?userId=${encodeURIComponent(userId)}`);
      } else {
        setError("このQRコードはフレンド申請には使用できません");
      }
    },
    [router, stopScanner],
  );

  const startScanner = useCallback(async () => {
    setError(null);
    await stopScanner();
    // Wait for the DOM element to be available
    await new Promise((r) => setTimeout(r, 100));

    const el = document.getElementById(READER_ID);
    if (!el) return;

    const scanner = new Html5Qrcode(READER_ID);
    scannerRef.current = scanner;

    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // QR not found in frame — ignore
        },
      );
    } catch (err) {
      const isNotFound = err instanceof DOMException && err.name === "NotFoundError";
      setError(
        isNotFound
          ? "カメラが見つかりません。画像アップロードをお試しください"
          : "カメラへのアクセスが許可されていません。画像アップロードをお試しください",
      );
    }
  }, [handleScanSuccess, stopScanner]);

  // Start/stop camera based on dialog open state and active tab
  useEffect(() => {
    if (open && tab === "camera") {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [open, tab, startScanner, stopScanner]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Ensure scanner instance exists for file scanning
    let scanner = scannerRef.current;
    if (!scanner) {
      scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
    }

    try {
      const result = await scanner.scanFileV2(file, false);
      await handleScanSuccess(result.decodedText);
    } catch {
      setError("QRコードを検出できませんでした。別の画像を試してください");
    }

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setError(null);
      setTab(isMobile ? "camera" : "image");
      processingRef.current = false;
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full">
              <ScanLine className="h-3.5 w-3.5" />
              読み取り
            </Button>
          </ResponsiveDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>QRコードを読み取る</TooltipContent>
      </Tooltip>
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>QRコードを読み取る</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        {isMobile ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="camera" className="flex-1 gap-1.5">
                <Video className="h-3.5 w-3.5" />
                カメラ
              </TabsTrigger>
              <TabsTrigger value="image" className="flex-1 gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                画像
              </TabsTrigger>
            </TabsList>
            <TabsContent value="camera">
              <div id={READER_ID} className="aspect-square w-full overflow-hidden rounded-lg" />
            </TabsContent>
            <TabsContent value="image">
              <ImageUploadArea fileInputRef={fileInputRef} onFileChange={handleFileChange} />
            </TabsContent>
          </Tabs>
        ) : (
          <ImageUploadArea fileInputRef={fileInputRef} onFileChange={handleFileChange} />
        )}
        {error && <p className="text-sm text-muted-foreground text-center">{error}</p>}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
