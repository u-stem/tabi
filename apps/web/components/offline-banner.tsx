"use client";

import { useOnlineStatus } from "@/lib/hooks/use-online-status";

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-yellow-950"
    >
      オフラインです
    </div>
  );
}
