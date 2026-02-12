import { Header } from "@/components/header";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-screen">
        <Header />
        <main className="container py-4 sm:py-8">{children}</main>
      </div>
    </TooltipProvider>
  );
}
