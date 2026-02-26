"use client";

import * as React from "react";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer";

// Share isMobile across all child components via context
// to avoid parent/child mismatch during hydration
const MobileContext = React.createContext(false);
function useMobileContext() {
  return React.useContext(MobileContext);
}

// Blur active element to prevent aria-hidden warnings
// when Drawer closes while a button inside still has focus
function blurActiveElement() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

interface ResponsiveDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function ResponsiveDialog({ children, onOpenChange, ...props }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) blurActiveElement();
      onOpenChange?.(open);
    },
    [onOpenChange],
  );

  const Comp = isMobile ? Drawer : Dialog;
  return (
    <MobileContext.Provider value={isMobile}>
      <Comp {...props} onOpenChange={handleOpenChange}>
        {children}
      </Comp>
    </MobileContext.Provider>
  );
}

function ResponsiveDialogTrigger({ ...props }: React.ComponentProps<typeof DialogTrigger>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerTrigger : DialogTrigger;
  return <Comp {...props} />;
}

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useMobileContext();
  if (isMobile) {
    return (
      <DrawerContent
        className={className}
        {...(props as React.ComponentProps<typeof DrawerContent>)}
      >
        {children}
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp {...props} />;
}

function ResponsiveDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useMobileContext();
  if (isMobile) {
    return <DrawerFooter className={cn("flex-row justify-end", className)} {...props} />;
  }
  return <DialogFooter className={className} {...props} />;
}

function ResponsiveDialogTitle({ ...props }: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerTitle : DialogTitle;
  return <Comp {...props} />;
}

function ResponsiveDialogDescription({ ...props }: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerDescription : DialogDescription;
  return <Comp {...props} />;
}

function ResponsiveDialogClose({ ...props }: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerClose : DialogClose;
  return <Comp {...props} />;
}

export {
  ResponsiveDialog,
  ResponsiveDialogTrigger,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogFooter,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogClose,
};
