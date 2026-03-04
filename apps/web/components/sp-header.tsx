"use client";

import { Monitor, Settings } from "lucide-react";
import Link from "next/link";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuestBanner } from "@/components/guest-banner";
import { InstallBanner } from "@/components/install-banner";
import { Logo } from "@/components/logo";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { switchViewMode } from "@/lib/view-mode";

/**
 * SP-specific header: simplified for mobile.
 * Navigation is handled by SpBottomNav (including notification and account menu).
 */
export function SpHeader() {
  return (
    <header className="sticky top-0 z-30 select-none border-b bg-background">
      <AnnouncementBanner />
      <OfflineBanner />
      <GuestBanner />
      <InstallBanner />
      <nav aria-label="メインナビゲーション" className="container flex h-14 items-center">
        <Logo href="/sp/home" />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="PC版で表示"
            onClick={() => void switchViewMode("desktop")}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <Monitor className="h-5 w-5" />
          </button>
          <ThemeToggle />
          <Link
            href="/sp/settings"
            aria-label="設定"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
