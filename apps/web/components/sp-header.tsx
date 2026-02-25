"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, LogOut, MessageSquare, Monitor, Settings } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);

import { GuestBanner } from "@/components/guest-banner";
import { Logo } from "@/components/logo";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { signOut, useSession } from "@/lib/auth-client";
import { isGuestUser } from "@/lib/guest";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

/**
 * SP-specific header: simplified for mobile.
 * Navigation is handled by SpBottomNav, so this header only has
 * the logo, theme toggle, and avatar menu.
 */
export function SpHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const isGuest = isGuestUser(session);
  // Prevent hydration mismatch: better-auth may return cached session synchronously
  // on the client while the server always starts with null.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function handleSignOut() {
    try {
      await signOut();
      queryClient.clear();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

  return (
    <header className="sticky top-0 z-30 select-none border-b bg-background">
      <OfflineBanner />
      <GuestBanner />
      <nav
        aria-label="メインナビゲーション"
        className="container flex h-14 items-center justify-between"
      >
        <Logo href="/sp/home" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {!mounted || !session?.user ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMobileMenuOpen(true);
                }}
              >
                <UserAvatar
                  name={session.user.name ?? ""}
                  image={session.user.image}
                  className="h-8 w-8"
                />
                <span className="sr-only">ユーザーメニュー</span>
              </Button>
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle className="truncate">{session.user.name}</SheetTitle>
                    <SheetDescription>
                      {session.user.displayUsername
                        ? `@${session.user.displayUsername}`
                        : session.user.username
                          ? `@${session.user.username}`
                          : ""}
                    </SheetDescription>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-1" aria-label="モバイルメニュー">
                    {!isGuest && (
                      <Link
                        href={`/sp/settings`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                          pathname === "/sp/settings"
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Settings className="h-4 w-4" />
                        設定
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackOpen(true);
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <MessageSquare className="h-4 w-4" />
                      フィードバック
                    </button>
                    {canInstall && (
                      <button
                        type="button"
                        onClick={() => {
                          promptInstall();
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Download className="h-4 w-4" />
                        アプリをインストール
                      </button>
                    )}
                    <div className="my-2 border-t" />
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void switchViewMode("desktop");
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Monitor className="h-4 w-4" />
                      PC版で表示
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      ログアウト
                    </button>
                  </nav>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </nav>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </header>
  );
}
