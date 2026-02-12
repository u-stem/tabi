"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ShortcutGroup = {
  group: string;
  items: { key: string; description: string }[];
};

type ShortcutHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ShortcutGroup[];
};

export function ShortcutHelpDialog({ open, onOpenChange, shortcuts }: ShortcutHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>キーボードショートカット</DialogTitle>
          <DialogDescription>このページで使えるショートカット一覧</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {shortcuts.map((group) => (
            <div key={group.group}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group.group}</h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-1">
                    <span className="text-sm">{item.description}</span>
                    <kbd
                      data-shortcut-key
                      className="rounded border bg-muted px-2 py-0.5 font-mono text-xs"
                    >
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
