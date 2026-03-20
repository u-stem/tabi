"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const ti = useTranslations("install");
  const { showBanner, isIos, promptInstall, dismiss } = useInstallBanner();
  const [iosDrawerOpen, setIosDrawerOpen] = useState(false);

  if (!showBanner) return null;

  return (
    <>
      <div className="animate-in slide-in-from-top fade-in duration-300 border-b bg-blue-50 dark:bg-blue-950/30">
        <div className="container flex items-center justify-between gap-2 px-4 py-1.5 text-sm">
          <span className="min-w-0 truncate text-blue-900 dark:text-blue-200">
            {ti("bannerText")}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {isIos ? (
              <button
                type="button"
                className="whitespace-nowrap rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-blue-950 dark:hover:bg-blue-400"
                onClick={() => setIosDrawerOpen(true)}
              >
                {ti("showHow")}
              </button>
            ) : (
              <button
                type="button"
                className="whitespace-nowrap rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:text-blue-950 dark:hover:bg-blue-400"
                onClick={promptInstall}
              >
                {ti("addToHome")}
              </button>
            )}
            <button
              type="button"
              aria-label={ti("closeBanner")}
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
            <DrawerTitle>{ti("drawerTitle")}</DrawerTitle>
            <DrawerDescription>{ti("drawerDescription")}</DrawerDescription>
          </DrawerHeader>
          <ol className="px-4 pb-8 space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                1
              </span>
              <span>
                {ti("step1")}{" "}
                <span className="inline-flex items-center rounded bg-muted px-1 font-mono text-xs">
                  {ti("step1Share")}
                </span>{" "}
                {ti("step1Suffix")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                2
              </span>
              <span>
                {ti("step2Prefix")} <span className="font-medium">{ti("step2Action")}</span>{" "}
                {ti("step2Suffix")}
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                3
              </span>
              <span>
                {ti("step3Prefix")} <span className="font-medium">{ti("step3Action")}</span>{" "}
                {ti("step3Suffix")}
              </span>
            </li>
          </ol>
        </DrawerContent>
      </Drawer>
    </>
  );
}
