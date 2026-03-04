"use client";

import { X } from "lucide-react";
import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useInstallBanner } from "@/lib/hooks/use-install-banner";

export function InstallBanner() {
  const { showBanner, isIos, promptInstall, dismiss } = useInstallBanner();
  const [iosDrawerOpen, setIosDrawerOpen] = useState(false);

  if (!showBanner) return null;

  return (
    <>
      <div className="border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="container flex items-center justify-between gap-2 px-4 py-1.5 text-sm">
          <span className="text-blue-900 dark:text-blue-200">アプリをホーム画面に追加できます</span>
          <div className="flex shrink-0 items-center gap-2">
            {isIos ? (
              <button
                type="button"
                className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-blue-950 dark:hover:bg-blue-400"
                onClick={() => setIosDrawerOpen(true)}
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

      <Drawer open={iosDrawerOpen} onOpenChange={setIosDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>ホーム画面に追加する方法</DrawerTitle>
            <DrawerDescription>以下の手順でホーム画面に追加できます</DrawerDescription>
          </DrawerHeader>
          <ol className="px-4 pb-8 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                1
              </span>
              <span>
                ブラウザの{" "}
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
                メニューをスクロールして <span className="font-medium">「ホーム画面に追加」</span>{" "}
                をタップ
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
        </DrawerContent>
      </Drawer>
    </>
  );
}
