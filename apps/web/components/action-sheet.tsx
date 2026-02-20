"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

interface ActionSheetAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
}

interface ActionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: ActionSheetAction[];
}

export function ActionSheet({ open, onOpenChange, actions }: ActionSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerTitle className="sr-only">アクション</DrawerTitle>
        <DrawerDescription className="sr-only">操作を選択してください</DrawerDescription>
        <div className="flex flex-col gap-2 pb-4 pt-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant === "destructive" ? "destructive" : "outline"}
              className="h-12 w-full text-base"
              onClick={() => {
                action.onClick();
                onOpenChange(false);
              }}
            >
              {action.icon && <span className="mr-2">{action.icon}</span>}
              {action.label}
            </Button>
          ))}
          <Button
            variant="outline"
            className="mt-1 h-12 w-full text-base"
            onClick={() => onOpenChange(false)}
          >
            キャンセル
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
