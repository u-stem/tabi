import { SpBottomNav } from "@/components/sp-bottom-nav";
import { SpHeader } from "@/components/sp-header";
import { SpMobileProvider } from "@/components/sp-mobile-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShortcutHelpProvider } from "@/lib/shortcut-help-context";

export default function SpLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ShortcutHelpProvider>
        <SpMobileProvider>
          <div className="min-h-screen">
            <SpHeader />
            <main className="container py-4 pb-16">{children}</main>
            <SpBottomNav />
          </div>
        </SpMobileProvider>
      </ShortcutHelpProvider>
    </TooltipProvider>
  );
}
