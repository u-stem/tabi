"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

function Toaster({ ...props }: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      className="toaster group"
      richColors
      position="top-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      {...props}
    />
  );
}

export { Toaster };
