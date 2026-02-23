"use client";

import * as React from "react";

import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogDestructiveAction,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./alert-dialog";
import { buttonVariants } from "./button";
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

interface ResponsiveAlertDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function ResponsiveAlertDialog({
  children,
  onOpenChange,
  ...props
}: ResponsiveAlertDialogProps) {
  const isMobile = useIsMobile();

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) blurActiveElement();
      onOpenChange?.(open);
    },
    [onOpenChange],
  );

  const Comp = isMobile ? Drawer : AlertDialog;
  return (
    <MobileContext.Provider value={isMobile}>
      <Comp {...props} onOpenChange={handleOpenChange}>
        {children}
      </Comp>
    </MobileContext.Provider>
  );
}

function ResponsiveAlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogTrigger>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerTrigger : AlertDialogTrigger;
  return <Comp {...props} />;
}

function ResponsiveAlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogContent>) {
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
    <AlertDialogContent className={className} {...props}>
      {children}
    </AlertDialogContent>
  );
}

function ResponsiveAlertDialogHeader({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerHeader : AlertDialogHeader;
  return <Comp {...props} />;
}

function ResponsiveAlertDialogFooter({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerFooter : AlertDialogFooter;
  return <Comp {...props} />;
}

function ResponsiveAlertDialogTitle({
  ...props
}: React.ComponentProps<typeof AlertDialogTitle>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerTitle : AlertDialogTitle;
  return <Comp {...props} />;
}

function ResponsiveAlertDialogDescription({
  ...props
}: React.ComponentProps<typeof AlertDialogDescription>) {
  const isMobile = useMobileContext();
  const Comp = isMobile ? DrawerDescription : AlertDialogDescription;
  return <Comp {...props} />;
}

function ResponsiveAlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogCancel>) {
  const isMobile = useMobileContext();
  if (isMobile) {
    return (
      <DrawerClose
        className={cn(buttonVariants({ variant: "outline" }), className)}
        {...(props as React.ComponentProps<typeof DrawerClose>)}
      />
    );
  }
  return <AlertDialogCancel className={className} {...props} />;
}

function ResponsiveAlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogAction>) {
  const isMobile = useMobileContext();
  if (isMobile) {
    return (
      <button
        type="button"
        className={cn(buttonVariants(), className)}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      />
    );
  }
  return <AlertDialogAction className={className} {...props} />;
}

function ResponsiveAlertDialogDestructiveAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogDestructiveAction>) {
  const isMobile = useMobileContext();
  if (isMobile) {
    return (
      <button
        type="button"
        className={cn(buttonVariants({ variant: "destructive" }), className)}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      />
    );
  }
  return <AlertDialogDestructiveAction className={className} {...props} />;
}

export {
  ResponsiveAlertDialog,
  ResponsiveAlertDialogTrigger,
  ResponsiveAlertDialogContent,
  ResponsiveAlertDialogHeader,
  ResponsiveAlertDialogFooter,
  ResponsiveAlertDialogTitle,
  ResponsiveAlertDialogDescription,
  ResponsiveAlertDialogCancel,
  ResponsiveAlertDialogAction,
  ResponsiveAlertDialogDestructiveAction,
};
