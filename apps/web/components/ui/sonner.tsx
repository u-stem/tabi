"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

import { useIsMobile } from "@/lib/hooks/use-is-mobile";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  return (
    <Sonner
      className="toaster group"
      richColors
      position={isMobile ? "top-center" : "bottom-right"}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      {...props}
    />
  );
}

export { Toaster };
