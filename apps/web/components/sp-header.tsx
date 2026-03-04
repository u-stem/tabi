"use client";

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
  return (
    <header className="sticky top-0 z-30 select-none border-b bg-background">
      <AnnouncementBanner />
      <OfflineBanner />
      <GuestBanner />
      <InstallBanner />
      <nav aria-label="メインナビゲーション" className="container flex h-14 items-center">
        <Logo href="/sp/home" />
      </nav>
    </header>
  );
}
