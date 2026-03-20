"use client";

import { useTranslations } from "next-intl";
import { useOnlineStatus } from "@/lib/hooks/use-online-status";

export function OfflineBanner() {
  const tc = useTranslations("common");
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <div
      role="alert"
      className="animate-in slide-in-from-top fade-in duration-300 bg-yellow-500 px-4 py-2 text-center text-sm font-medium text-yellow-950 dark:bg-yellow-600 dark:text-yellow-100"
    >
      {tc("offline")}
    </div>
  );
}
