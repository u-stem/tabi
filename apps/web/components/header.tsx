"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";

export function Header() {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <header className="border-b">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/dashboard" className="text-xl font-bold">
          tabi
        </Link>
        <div className="flex items-center gap-4">
          {session?.user && (
            <>
              <span className="text-sm text-muted-foreground">
                {session.user.name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                ログアウト
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
