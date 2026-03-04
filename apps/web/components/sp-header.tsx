"use client";

import { Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuestBanner } from "@/components/guest-banner";
import { InstallBanner } from "@/components/install-banner";
import { Logo } from "@/components/logo";
import { OfflineBanner } from "@/components/offline-banner";

/**
 * SP-specific header: simplified for mobile.
 * Navigation is handled by SpBottomNav (including notification and account menu).
 */
export function SpHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-30 select-none border-b bg-background">
      <AnnouncementBanner />
      <OfflineBanner />
      <GuestBanner />
      <InstallBanner />
      <nav aria-label="メインナビゲーション" className="container flex h-14 items-center">
        <Logo href="/sp/home" />
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/sp/settings"
            aria-label="設定"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <Settings className="h-5 w-5" />
          </Link>
          {mounted && (
            <button
              type="button"
              aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
