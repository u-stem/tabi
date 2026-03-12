"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Monitor, Settings, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogTrigger,
} from "@/components/ui/responsive-alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { MSG } from "@/lib/messages";
import { cn } from "@/lib/utils";
import { switchViewMode } from "@/lib/view-mode";

const ANIMATION_DURATION = 300;

function useMenuState() {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const animatingRef = useRef(false);
  const pathname = usePathname();

  function toggle() {
    if (animatingRef.current) return;
    animatingRef.current = true;
    setExpanded((prev) => !prev);
    setTimeout(() => {
      animatingRef.current = false;
    }, ANIMATION_DURATION);
  }

  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [expanded]);

  return { expanded, toggle, ref };
}

/** Animated hamburger icon that morphs to X via CSS transitions. */
function HamburgerIcon({ open, className }: { open: boolean; className?: string }) {
  const bar =
    "absolute left-1/2 h-[2px] w-5 -translate-x-1/2 rounded-full bg-current transition-all duration-300";

  return (
    <span className={cn("relative block h-5 w-5", className)} aria-hidden>
      <span className={cn(bar, open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[3px]")} />
      <span className={cn(bar, "top-1/2 -translate-y-1/2", open && "opacity-0")} />
      <span
        className={cn(bar, open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-[3px] top-auto")}
      />
    </span>
  );
}

/**
 * Collapsible header menu for desktop.
 * Click the hamburger to reveal: SP toggle, theme, settings, logout.
 */
export function HeaderMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { expanded, toggle, ref } = useMenuState();

  const showSpToggle = !/\/(print|export)(\/|$)/.test(pathname);

  return (
    <div ref={ref} className="flex items-center">
      {expanded && (
        <div className="flex items-center gap-1 animate-in fade-in duration-150">
          {showSpToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="SP版で表示"
                  onClick={() => void switchViewMode("sp", (url) => router.push(url))}
                  className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Smartphone className="h-5 w-5 transition-transform duration-200 group-hover:-rotate-12" />
                </button>
              </TooltipTrigger>
              <TooltipContent>SP版で表示</TooltipContent>
            </Tooltip>
          )}
          <ThemeToggle />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                aria-label="設定"
                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Settings className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>設定</TooltipContent>
          </Tooltip>
          <SignOutButton />
        </div>
      )}
      <button
        type="button"
        aria-label={expanded ? "メニューを閉じる" : "メニューを開く"}
        aria-expanded={expanded}
        onClick={toggle}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <HamburgerIcon open={expanded} />
      </button>
    </div>
  );
}

/**
 * Collapsible header menu for SP.
 * Tap the hamburger to toggle: PC toggle, theme, settings, logout.
 */
export function SpHeaderMenu() {
  const router = useRouter();
  const { expanded, toggle, ref } = useMenuState();

  return (
    <div ref={ref} className="flex items-center">
      {expanded && (
        <div className="flex items-center gap-1 animate-in fade-in duration-150">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="PC版で表示"
                onClick={() => void switchViewMode("desktop", (url) => router.push(url))}
                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Monitor className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
              </button>
            </TooltipTrigger>
            <TooltipContent>PC版で表示</TooltipContent>
          </Tooltip>
          <ThemeToggle iconClassName="h-6 w-6" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/sp/settings"
                aria-label="設定"
                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Settings className="h-6 w-6 transition-transform duration-300 group-hover:rotate-90" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>設定</TooltipContent>
          </Tooltip>
          <SignOutButton />
        </div>
      )}
      <button
        type="button"
        aria-label={expanded ? "メニューを閉じる" : "メニューを開く"}
        aria-expanded={expanded}
        onClick={toggle}
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <HamburgerIcon open={expanded} className="h-6 w-6" />
      </button>
    </div>
  );
}

function SignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await authClient.signOut();
      queryClient.clear();
      router.push("/");
    } catch {
      toast.error(MSG.AUTH_LOGOUT_FAILED);
      setLoading(false);
    }
  }

  return (
    <ResponsiveAlertDialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ResponsiveAlertDialogTrigger asChild>
            <button
              type="button"
              aria-label="ログアウト"
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </ResponsiveAlertDialogTrigger>
        </TooltipTrigger>
        <TooltipContent>ログアウト</TooltipContent>
      </Tooltip>
      <ResponsiveAlertDialogContent>
        <ResponsiveAlertDialogHeader>
          <ResponsiveAlertDialogTitle>ログアウトしますか？</ResponsiveAlertDialogTitle>
          <ResponsiveAlertDialogDescription>
            このデバイスからサインアウトされます。
          </ResponsiveAlertDialogDescription>
        </ResponsiveAlertDialogHeader>
        <ResponsiveAlertDialogFooter>
          <ResponsiveAlertDialogCancel disabled={loading}>
            <X className="h-4 w-4" />
            キャンセル
          </ResponsiveAlertDialogCancel>
          <Button disabled={loading} onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            {loading ? "ログアウト中..." : "ログアウト"}
          </Button>
        </ResponsiveAlertDialogFooter>
      </ResponsiveAlertDialogContent>
    </ResponsiveAlertDialog>
  );
}
