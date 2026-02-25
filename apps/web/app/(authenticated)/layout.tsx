import { BottomNav } from "@/components/bottom-nav";
import { Header } from "@/components/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShortcutHelpProvider } from "@/lib/shortcut-help-context";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <ShortcutHelpProvider>
        <div className="min-h-screen">
          <Header />
          {/* overflow-x-auto + min-w ensures desktop content never collapses below 1024px.
              When viewed on a narrow screen (e.g. phone in desktop mode), the content area
              scrolls horizontally — the same behavior as "Request Desktop Site" in browsers.
              Header and BottomNav remain viewport-width as they already handle narrow screens. */}
          <div className="overflow-x-auto">
            <div className="min-w-[1024px]">
              <main className="container py-4 pb-16 sm:py-8 sm:pb-8">{children}</main>
            </div>
          </div>
          <BottomNav />
        </div>
      </ShortcutHelpProvider>
    </TooltipProvider>
  );
}
