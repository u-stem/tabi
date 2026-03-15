"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

const Drawer = ({
  shouldScaleBackground = false,
  // Disable vaul's built-in input repositioning: it moves the drawer upward when
  // an input is focused, but after the keyboard dismisses the drawer can end up
  // at the wrong height, showing only a partial view of its content.
  repositionInputs = false,
  // Disable vaul's body style manipulation (position: fixed, top: -scrollY).
  // This app uses a custom scroll container (SpScrollContainer) instead of body scroll,
  // so vaul's scroll lock incorrectly shifts the page upward when the drawer opens.
  noBodyStyles = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root
    shouldScaleBackground={shouldScaleBackground}
    repositionInputs={repositionInputs}
    noBodyStyles={noBodyStyles}
    {...props}
  />
);

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

// Offset drawer above virtual keyboard (repositionInputs is disabled)
function useKeyboardOffset() {
  const [offset, setOffset] = React.useState(0);
  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function handleResize() {
      if (!vv) return;
      // Ignore pinch-zoom: only respond to keyboard-induced viewport shrink
      if (vv.scale !== 1) return;
      const kb = window.innerHeight - vv.height;
      setOffset(kb > 0 ? kb : 0);
    }
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);
  return offset;
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const keyboardOffset = useKeyboardOffset();
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[92vh] flex-col rounded-t-[10px] border bg-background outline-none transition-transform duration-200",
          className,
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : undefined,
        }}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-6">
          {children}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 py-4 text-center sm:text-left", className)} {...props} />
);

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 py-4", className)} {...props} />
);

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
