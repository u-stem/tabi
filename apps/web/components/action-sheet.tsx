"use client";

import { X } from "lucide-react";
import { type ReactNode, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

interface ActionSheetAction {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  href?: string;
  target?: string;
  variant?: "default" | "destructive";
}

interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ActionSheetAction[];
}

export function ActionSheet({ open, onOpenChange, actions }: ActionSheetProps) {
  // Blur any focused element before the drawer applies aria-hidden to the page.
  // useLayoutEffect fires before Radix's useEffect that sets aria-hidden,
  // preventing the "aria-hidden on focused element's ancestor" browser warning.
  // Blur on both open and close: opening sets aria-hidden on the page (requires blur before),
  // closing triggers Vaul's data-state=closed while aria-hidden is still on the drawer.
  useLayoutEffect(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [open]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerTitle className="sr-only">アクション</DrawerTitle>
        <DrawerDescription className="sr-only">操作を選択してください</DrawerDescription>
        <div className="flex flex-col gap-2 pb-4 pt-2">
          {actions.map((action) =>
            action.href ? (
              <Button
                key={action.label}
                variant={action.variant === "destructive" ? "destructive" : "outline"}
                className="h-12 w-full justify-start text-base"
                asChild
              >
                <a
                  href={action.href}
                  target={action.target}
                  rel={action.target === "_blank" ? "noopener noreferrer" : undefined}
                  onClick={() => onOpenChange(false)}
                >
                  {action.icon && <span className="mr-2">{action.icon}</span>}
                  {action.label}
                </a>
              </Button>
            ) : (
              <Button
                key={action.label}
                variant={action.variant === "destructive" ? "destructive" : "outline"}
                className="h-12 w-full justify-start text-base"
                onClick={() => {
                  action.onClick?.();
                  onOpenChange(false);
                }}
              >
                {action.icon && <span className="mr-2">{action.icon}</span>}
                {action.label}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            className="mt-1 h-12 w-full justify-start text-base"
            onClick={() => onOpenChange(false)}
          >
            <X className="mr-2 h-4 w-4" />
            キャンセル
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
