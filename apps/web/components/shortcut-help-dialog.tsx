"use client";

import { useTranslations } from "next-intl";
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

function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split(" ");
  if (parts.length === 1) {
    return (
      <kbd data-shortcut-key className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
        {keys}
      </kbd>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((part, i) => (
        <span key={part} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              →
            </span>
          )}
          <kbd data-shortcut-key className="rounded border bg-muted px-2 py-0.5 font-mono text-xs">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export function ShortcutHelpDialog({ open, onOpenChange, shortcuts }: ShortcutHelpDialogProps) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("shortcuts")}</DialogTitle>
          <DialogDescription>{t("shortcutsDescription")}</DialogDescription>
        </DialogHeader>
        <div className="select-none space-y-4">
          {shortcuts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("noShortcuts")}</p>
          ) : (
            shortcuts.map((group) => (
              <div key={group.group}>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">{group.group}</h3>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1">
                      <span className="text-sm">{item.description}</span>
                      <ShortcutKeys keys={item.key} />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
