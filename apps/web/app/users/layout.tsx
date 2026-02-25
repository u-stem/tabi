"use client";

import { Header } from "@/components/header";
import { DesktopMobileProvider } from "@/components/sp-mobile-provider";
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
    <DesktopMobileProvider>
      <TooltipProvider>
        <ShortcutHelpProvider>
          <div className="min-h-screen">
            <div className="overflow-x-auto">
              <div className="min-w-[1024px]">
                <Header />
                <main className="container py-4 sm:py-8">{children}</main>
              </div>
            </div>
          </div>
        </ShortcutHelpProvider>
      </TooltipProvider>
    </DesktopMobileProvider>
  );
}
