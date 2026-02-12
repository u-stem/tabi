"use client";

import { Download, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { getSeasonalBg, Logo } from "@/components/logo";
import { OfflineBanner } from "@/components/offline-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { signOut, useSession } from "@/lib/auth-client";
import { useInstallPrompt } from "@/lib/hooks/use-install-prompt";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/home", label: "ホーム" },
  { href: "/shared-trips", label: "共有" },
] as const;

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
    }
  }

  return (
    <header className="border-b">
      <OfflineBanner />
      <nav
        aria-label="メインナビゲーション"
        className="container flex h-14 items-center justify-between"
      >
        <div className="flex items-center gap-6">
          <Logo href="/home" />
          {session?.user &&
            NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "hidden rounded-md px-3 py-1.5 text-sm transition-colors sm:inline-flex",
                  pathname === link.href
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
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
                    <Avatar className="h-8 w-8">
                      <AvatarFallback
                        className={`${getSeasonalBg()} text-sm font-medium text-white`}
                      >
                        {session.user.name?.charAt(0).toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">ユーザーメニュー</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{session.user.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
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

              {/* Mobile: hamburger + sheet */}
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">メニュー</span>
              </Button>
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetContent side="right">
                  <SheetHeader>
                    <SheetTitle>{session.user.name}</SheetTitle>
                    <SheetDescription>{session.user.email}</SheetDescription>
                  </SheetHeader>
                  <nav className="mt-6 flex flex-col gap-2" aria-label="モバイルナビゲーション">
                    {NAV_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "rounded-md px-3 py-2 text-sm transition-colors",
                          pathname === link.href
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {link.label}
                      </Link>
                    ))}
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
    </header>
  );
}
