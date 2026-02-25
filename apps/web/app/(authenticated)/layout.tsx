import { Header } from "@/components/header";
import { DesktopMobileProvider } from "@/components/sp-mobile-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShortcutHelpProvider } from "@/lib/shortcut-help-context";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <DesktopMobileProvider>
      <TooltipProvider>
        <ShortcutHelpProvider>
          <div className="min-h-screen">
            {/* Desktop layout always renders at minimum 1024px wide.
                Header and main scroll horizontally together when the viewport is narrower
                (e.g. phone in "PC版" mode) — the same behavior as "Request Desktop Site".
                Header stays sticky vertically; the browser handles horizontal scrolling
                at the document level. */}
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
