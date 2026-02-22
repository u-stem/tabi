"use client";

import type * as React from "react";

import { useIsMobile } from "@/lib/hooks/use-is-mobile";

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

interface ResponsiveDialogProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function ResponsiveDialog({ children, ...props }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? Drawer : Dialog;
  return <Comp {...props}>{children}</Comp>;
}

function ResponsiveDialogTrigger({ ...props }: React.ComponentProps<typeof DialogTrigger>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerTrigger : DialogTrigger;
  return <Comp {...props} />;
}

const preventAutoFocus = (e: Event) => e.preventDefault();

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <DrawerContent
        className={className}
        {...(props as React.ComponentProps<typeof DrawerContent>)}
        onOpenAutoFocus={preventAutoFocus}
      >
        {children}
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={className} {...props} onOpenAutoFocus={preventAutoFocus}>
      {children}
    </DialogContent>
  );
}

function ResponsiveDialogHeader({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerHeader : DialogHeader;
  return <Comp {...props} />;
}

function ResponsiveDialogFooter({ ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerFooter : DialogFooter;
  return <Comp {...props} />;
}

function ResponsiveDialogTitle({ ...props }: React.ComponentProps<typeof DialogTitle>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerTitle : DialogTitle;
  return <Comp {...props} />;
}

function ResponsiveDialogDescription({ ...props }: React.ComponentProps<typeof DialogDescription>) {
  const isMobile = useIsMobile();
  const Comp = isMobile ? DrawerDescription : DialogDescription;
  return <Comp {...props} />;
}

function ResponsiveDialogClose({ ...props }: React.ComponentProps<typeof DialogClose>) {
  const isMobile = useIsMobile();
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
