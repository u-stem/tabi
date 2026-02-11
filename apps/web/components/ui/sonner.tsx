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
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      {...props}
    />
  );
}

export { Toaster };
