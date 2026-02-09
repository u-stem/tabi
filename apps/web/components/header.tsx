"use client";

import { CircleUser, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";

export function Header() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
    } catch {
      toast.error("ログアウトに失敗しました");
    }
  }

  return (
    <header className="border-b">
      <OfflineBanner />
      <nav
        aria-label="メインナビゲーション"
        className="container flex h-14 items-center justify-between"
      >
        <Link href="/home" className="text-xl font-bold">
          tabi
        </Link>
        <div className="flex items-center gap-4">
          {session?.user && (
            <>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <CircleUser className="h-4 w-4" />
                {session.user.name}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
                ログアウト
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
