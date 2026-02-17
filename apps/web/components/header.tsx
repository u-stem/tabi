"use client";

import type { FriendRequestResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { Download, Keyboard, LogOut, MessageSquare, Settings, User } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const FeedbackDialog = dynamic(() =>
  import("@/components/feedback-dialog").then((mod) => mod.FeedbackDialog),
);

import { Logo } from "@/components/logo";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { api } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth-client";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { MSG } from "@/lib/messages";
import { NAV_LINKS } from "@/lib/nav-links";
import { queryKeys } from "@/lib/query-keys";
import { useShortcutHelp } from "@/lib/shortcut-help-context";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canInstall, promptInstall } = useInstallPrompt();
  const { open: openShortcutHelp } = useShortcutHelp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const { data: friendRequests } = useQuery({
    queryKey: queryKeys.friends.requests(),
    queryFn: () => api<FriendRequestResponse[]>("/api/friends/requests"),
    enabled: !!session?.user,
    refetchInterval: 60_000,
  });
  const friendRequestCount = friendRequests?.length ?? 0;

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

  return (
    <header className="select-none border-b">
      <OfflineBanner />
      <nav
        aria-label="メインナビゲーション"
        className="container flex h-14 items-center justify-between"
      >
        <div className="flex items-center gap-6">
          <Logo href="/home" />
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "hidden items-center gap-1 rounded-md px-3 py-1.5 text-sm transition-colors sm:inline-flex",
                pathname === link.href
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {link.label}
              {link.href === "/friends" && friendRequestCount > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
                  {friendRequestCount}
                </span>
              )}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          {session?.user && (
            <>
              {/* Desktop: dropdown menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden rounded-full sm:inline-flex"
                  >
                    <UserAvatar
                      name={session.user.name ?? ""}
                      image={session.user.image}
                      className="h-8 w-8"
                    />
                    <span className="sr-only">ユーザーメニュー</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="truncate">{session.user.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/users/${session.user.id}`}>
                      <User className="h-4 w-4" />
                      プロフィール
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings className="h-4 w-4" />
                      設定
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openShortcutHelp} className="hidden sm:flex">
                    <Keyboard className="h-4 w-4" />
                    ショートカット
                    <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                      ?
                    </kbd>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFeedbackOpen(true)}>
                    <MessageSquare className="h-4 w-4" />
                    フィードバック
                  </DropdownMenuItem>
                  {canInstall && (
                    <DropdownMenuItem onClick={promptInstall}>
                      <Download className="h-4 w-4" />
                      アプリをインストール
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="h-4 w-4" />
                    ログアウト
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile: avatar + sheet (nav links handled by BottomNav) */}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full sm:hidden"
                onClick={() => setMobileMenuOpen(true)}
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
                    <Link
                      href={`/users/${session.user.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <User className="h-4 w-4" />
                      プロフィール
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                        pathname === "/settings"
                          ? "bg-muted font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      設定
                    </Link>
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
