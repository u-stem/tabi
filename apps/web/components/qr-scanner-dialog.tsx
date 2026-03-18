"use client";

import type { UserProfileResponse } from "@sugara/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, ImageIcon, ScanLine, UserPlus } from "lucide-react";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { DialogSwipeTabs, type DialogTab } from "@/components/dialog-swipe-tabs";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { ApiError, api, getApiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { broadcastFriendsUpdate } from "@/lib/hooks/use-friends-sync";
import { useMobile } from "@/lib/hooks/use-is-mobile";
import { MSG } from "@/lib/messages";
import { parseQrFriendUrl } from "@/lib/qr-utils";
import { queryKeys } from "@/lib/query-keys";

const CAMERA_READER_ID = "qr-camera-reader";
const FILE_READER_ID = "qr-file-reader";

type ScanTabId = "camera" | "image";

const MOBILE_TABS: DialogTab<ScanTabId>[] = [
  { id: "camera", label: "カメラ" },
  { id: "image", label: "画像" },
];

function ImageUploadArea({
  fileInputRef,
  onFileChange,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 py-6 transition-colors hover:border-muted-foreground/50">
      <ImageIcon className="h-8 w-8 text-muted-foreground" />
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

function ConfirmStep({
  userId,
  onBack,
  onComplete,
}: {
  userId: string;
  onBack: () => void;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const isSelf = !!currentUserId && currentUserId === userId;

  const {
    data: profile,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.users.profile(userId),
    queryFn: () => api<UserProfileResponse>(`/api/users/${userId}/profile`),
    enabled: !isSelf,
    retry: false,
  });

  const [sending, setSending] = useState(false);
  const [alreadyFriend, setAlreadyFriend] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      await api("/api/friends/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeId: userId }),
      });
      toast.success(MSG.FRIEND_REQUEST_SENT);
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all });
      broadcastFriendsUpdate(userId);
      onComplete();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadyFriend(true);
      }
      toast.error(
        getApiErrorMessage(err, MSG.FRIEND_REQUEST_SEND_FAILED, {
          conflict: "すでにフレンドか申請済みです",
        }),
      );
    } finally {
      setSending(false);
    }
  }

  if (isSelf) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-muted-foreground">自分自身にフレンド申請はできません</p>
        </div>
        <ResponsiveDialogFooter className="[&>*]:flex-1">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            戻る
          </Button>
        </ResponsiveDialogFooter>
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-muted-foreground">ユーザーが見つかりません</p>
        </div>
        <ResponsiveDialogFooter className="[&>*]:flex-1">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            戻る
          </Button>
        </ResponsiveDialogFooter>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-4 py-4">
        <UserAvatar
          name={profile.name}
          image={profile.image}
          className="h-16 w-16"
          fallbackClassName="text-2xl"
        />
        <h3 className="text-lg font-semibold">{profile.name}</h3>
      </div>
      <ResponsiveDialogFooter className="[&>*]:flex-1">
        {alreadyFriend ? (
          <Button disabled>すでにフレンドか申請済みです</Button>
        ) : (
          <Button onClick={handleSend} disabled={sending} className="w-full">
            <UserPlus className="mr-1 h-4 w-4" />
            {sending ? "送信中..." : "フレンド申請を送る"}
          </Button>
        )}
      </ResponsiveDialogFooter>
    </>
  );
}

export function QrScannerDialog({
  initialUserId,
  onInitialUserIdConsumed,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  initialUserId?: string | null;
  onInitialUserIdConsumed?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
} = {}) {
  const isMobile = useMobile();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? (v: boolean) => controlledOnOpenChange?.(v) : setUncontrolledOpen;
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ScanTabId>("camera");
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  // Auto-open with initialUserId from URL (e.g. native camera QR scan)
  useEffect(() => {
    if (initialUserId) {
      setTargetUserId(initialUserId);
      setOpen(true);
      onInitialUserIdConsumed?.();
    }
  }, [initialUserId, onInitialUserIdConsumed]);

  function handleTabChange(value: string) {
    setTab(value as ScanTabId);
    setError(null);
  }
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
        setTargetUserId(userId);
      } else {
        setError("このQRコードはフレンド申請には使用できません");
      }
    },
    [stopScanner],
  );

  const startScanner = useCallback(async () => {
    setError(null);
    await stopScanner();
    // Wait for the DOM element to be available
    await new Promise((r) => setTimeout(r, 100));

    const el = document.getElementById(CAMERA_READER_ID);
    if (!el) return;

    // Check camera availability before requesting access
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("カメラが見つかりません。画像アップロードをお試しください");
      return;
    }

    try {
      const permission = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });
      if (permission.state === "denied") {
        setError("カメラへのアクセスが許可されていません。画像アップロードをお試しください");
        return;
      }
    } catch {
      // Permissions API not supported — proceed and let getUserMedia handle it
    }

    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode(CAMERA_READER_ID);
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
    if (open && tab === "camera" && !targetUserId) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [open, tab, targetUserId, startScanner, stopScanner]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // Use a separate hidden element for file scanning
    const { Html5Qrcode } = await import("html5-qrcode");
    const fileScannerInstance = new Html5Qrcode(FILE_READER_ID);

    try {
      const result = await fileScannerInstance.scanFileV2(file, false);
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
      setTab("camera");
      setTargetUserId(null);
      processingRef.current = false;
    }
  }

  const renderScanContent = useCallback(
    (tabId: ScanTabId) => {
      switch (tabId) {
        case "camera":
          return (
            <div
              id={CAMERA_READER_ID}
              className="aspect-square w-full overflow-hidden rounded-lg"
            />
          );
        case "image":
          return <ImageUploadArea fileInputRef={fileInputRef} onFileChange={handleFileChange} />;
      }
    },
    [handleFileChange],
  );

  const defaultTrigger = (
    <Button variant="outline">
      <ScanLine className="mr-1 h-4 w-4" />
      QR読み取り
    </Button>
  );
  const resolvedTrigger = trigger ?? defaultTrigger;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      {!initialUserId && (
        <ResponsiveDialogTrigger asChild>{resolvedTrigger}</ResponsiveDialogTrigger>
      )}
      <ResponsiveDialogContent className="sm:max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>QR読み取り</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div id={FILE_READER_ID} className="hidden" />
        {targetUserId ? (
          <ConfirmStep
            userId={targetUserId}
            onBack={() => {
              setTargetUserId(null);
              processingRef.current = false;
            }}
            onComplete={() => setOpen(false)}
          />
        ) : (
          <>
            {isMobile ? (
              <DialogSwipeTabs
                tabs={MOBILE_TABS}
                activeTab={tab}
                onTabChange={handleTabChange}
                renderContent={renderScanContent}
              />
            ) : (
              <ImageUploadArea fileInputRef={fileInputRef} onFileChange={handleFileChange} />
            )}
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
          </>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
