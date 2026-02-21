"use client";

import { useState } from "react";
import { GuestUpgradeDialog } from "@/components/guest-upgrade-dialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import { getGuestDaysRemaining, isGuestUser } from "@/lib/guest";

export function GuestBanner() {
  const { data: session } = useSession();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (!isGuestUser(session)) return null;

  const daysRemaining = getGuestDaysRemaining(session);

  return (
    <>
      <div className="border-b bg-amber-50 dark:bg-amber-950/30">
        <div className="container flex items-center justify-between px-4 py-1.5 text-sm">
          <span className="text-amber-900 dark:text-amber-200">
            ゲストモード（残り{daysRemaining}日）
          </span>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            onClick={() => setUpgradeOpen(true)}
          >
            アカウント登録
          </Button>
        </div>
      </div>
      <GuestUpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}
