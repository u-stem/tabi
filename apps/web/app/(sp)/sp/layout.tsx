import { GlobalShortcutHotkey } from "@/components/global-shortcut-hotkey";
import { SpBottomNav } from "@/components/sp-bottom-nav";
import { SpHeader } from "@/components/sp-header";
import { SpMobileProvider } from "@/components/sp-mobile-provider";
import { SpScrollContainer } from "@/components/sp-scroll-container";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShortcutHelpProvider } from "@/lib/shortcut-help-context";

export default function SpLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ShortcutHelpProvider>
        <GlobalShortcutHotkey />
        <SpMobileProvider>
          <div className="flex h-full flex-col">
            <SpHeader />
            <SpScrollContainer>
              <main className="container py-4 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
                {children}
              </main>
              <SpBottomNav />
            </SpScrollContainer>
          </div>
        </SpMobileProvider>
      </ShortcutHelpProvider>
    </TooltipProvider>
  );
}
