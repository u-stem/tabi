"use client";

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
        <Link href="/dashboard" className="text-xl font-bold">
          tabi
        </Link>
        <div className="flex items-center gap-4">
          {session?.user && (
            <>
              <span className="text-sm text-muted-foreground">{session.user.name}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                ログアウト
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
