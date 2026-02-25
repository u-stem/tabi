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
            <Header />
            <main className="container py-4 sm:py-8">{children}</main>
          </div>
        </ShortcutHelpProvider>
      </TooltipProvider>
    </DesktopMobileProvider>
  );
}
