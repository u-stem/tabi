"use client";

import { X } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInstallBanner } from "@/lib/hooks/use-install-banner";

export function InstallBanner() {
  const { showBanner, isIos, promptInstall, dismiss } = useInstallBanner();
  const [iosDialogOpen, setIosDialogOpen] = useState(false);

  if (!showBanner) return null;

  return (
    <>
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="container flex items-center justify-between gap-2 px-4 py-1.5 text-sm">
          <span className="text-blue-900 dark:text-blue-200">
            このアプリをホーム画面に追加できます
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {isIos ? (
              <button
                type="button"
                className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-blue-950 dark:hover:bg-blue-400"
                onClick={() => setIosDialogOpen(true)}
              >
                追加方法を見る
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-blue-950 dark:hover:bg-blue-400"
                onClick={promptInstall}
              >
                ホーム画面に追加
              </button>
            )}
            <button
              type="button"
              aria-label="バナーを閉じる"
              className="text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
              onClick={dismiss}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={iosDialogOpen} onOpenChange={setIosDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ホーム画面に追加する方法</DialogTitle>
            <DialogDescription>
              Safari でこのページを開き、以下の手順で追加してください
            </DialogDescription>
          </DialogHeader>
          <ol className="mt-2 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                1
              </span>
              <span>
                画面下部の{" "}
                <span className="inline-flex items-center rounded bg-muted px-1 font-mono text-xs">
                  共有
                </span>{" "}
                ボタン（四角から上矢印が出たアイコン）をタップ
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                2
              </span>
              <span>
                メニューをスクロールして{" "}
                <span className="font-medium">「ホーム画面に追加」</span> をタップ
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                3
              </span>
              <span>
                右上の <span className="font-medium">「追加」</span> をタップ
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
