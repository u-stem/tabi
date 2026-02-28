"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GuestUpgradeDialog } from "@/components/guest-upgrade-dialog";
import { useSession } from "@/lib/auth-client";
import { getGuestDaysRemaining, isGuestUser } from "@/lib/guest";
import { queryKeys } from "@/lib/query-keys";

async function fetchPublicSettings(): Promise<{ signupEnabled: boolean }> {
  const res = await fetch("/api/public/settings");
  if (!res.ok) return { signupEnabled: true };
  return res.json();
}

export function GuestBanner() {
  const { data: session } = useSession();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const { data: settings } = useQuery({
    queryKey: queryKeys.publicSettings.all,
    queryFn: fetchPublicSettings,
    staleTime: 5 * 60 * 1000,
  });

  if (!isGuestUser(session)) return null;

  const daysRemaining = getGuestDaysRemaining(session);
  const signupEnabled = settings?.signupEnabled ?? true;

  return (
    <>
      <div className="border-b bg-amber-50 dark:bg-amber-950/30">
        <div className="container flex items-center justify-between px-4 py-1.5 text-sm">
          <span className="text-amber-900 dark:text-amber-200">
            ゲストモード（残り{daysRemaining}日）
          </span>
          {signupEnabled && (
            <button
              type="button"
              className="rounded-full bg-amber-600 px-3 py-0.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-400"
              onClick={() => setUpgradeOpen(true)}
            >
              アカウント登録
            </button>
          )}
        </div>
      </div>
      <GuestUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
