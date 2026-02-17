"use client";

import { BottomNav } from "@/components/bottom-nav";
import { Header } from "@/components/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSession } from "@/lib/auth-client";
import { ShortcutHelpProvider } from "@/lib/shortcut-help-context";

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  // While checking auth or when not authenticated, let the page handle its own layout
  if (isPending || !session) {
    return children;
  }

  return (
    <TooltipProvider>
      <ShortcutHelpProvider>
        <div className="min-h-screen">
          <Header />
          <main className="container py-4 pb-16 sm:py-8 sm:pb-8">{children}</main>
          <BottomNav />
        </div>
      </ShortcutHelpProvider>
    </TooltipProvider>
  );
}
