"use client";

import { BottomNavBase } from "@/components/bottom-nav";
import { SP_NAV_LINKS } from "@/lib/nav-links";

export function SpBottomNav() {
  return <BottomNavBase links={SP_NAV_LINKS} friendHref="/sp/friends" />;
}
