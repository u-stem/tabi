"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { ActionSheet } from "@/components/action-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMobile } from "@/lib/hooks/use-is-mobile";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const isMobile = useMobile();
  const [open, setOpen] = useState(false);

  const icon = (
    <>
      <Sun className="h-6 w-6 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute h-6 w-6 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      <span className="sr-only">テーマ切替</span>
    </>
  );

  if (isMobile) {
    return (
      <>
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
          {icon}
        </Button>
        <ActionSheet
          open={open}
          onOpenChange={setOpen}
          actions={[
            {
              label: "ライト",
              icon: <Sun className="h-6 w-6" />,
              onClick: () => setTheme("light"),
            },
            {
              label: "ダーク",
              icon: <Moon className="h-6 w-6" />,
              onClick: () => setTheme("dark"),
            },
            {
              label: "システム",
              icon: <Monitor className="h-6 w-6" />,
              onClick: () => setTheme("system"),
            },
          ]}
        />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {icon}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="h-6 w-6" />
          ライト
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="h-6 w-6" />
          ダーク
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="h-6 w-6" />
          システム
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
