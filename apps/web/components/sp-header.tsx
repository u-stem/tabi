"use client";

import { useEffect, useState } from "react";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { GuestBanner } from "@/components/guest-banner";
import { InstallBanner } from "@/components/install-banner";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/notification-bell";
import { OfflineBanner } from "@/components/offline-banner";
import { useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";

/**
 * SP-specific header: simplified for mobile.
 * Navigation is handled by SpBottomNav (including the account menu trigger),
 * so this header only has the logo, theme toggle, and notification bell.
 */
export function SpHeader() {
  const { data: session } = useSession();
  const isGuest = isGuestUser(session);
  // Prevent hydration mismatch: better-auth may return cached session synchronously
  // on the client while the server always starts with null.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-30 select-none border-b bg-background">
      <AnnouncementBanner />
      <OfflineBanner />
      <GuestBanner />
      <InstallBanner />
      <nav
        aria-label="メインナビゲーション"
        className="container flex h-14 items-center justify-between"
      >
        <Logo href="/sp/home" />
        <div className="flex items-center gap-1">
          {mounted && session?.user && !isGuest && (
            <NotificationBell buttonClassName="h-6 w-6 p-0 [&_svg]:size-6" />
          )}
        </div>
      </nav>
    </header>
  );
}
