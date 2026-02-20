# Mobile Trip Detail Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the trip detail page for mobile with tab-based navigation, bottom sheets, swipe actions, and native-app-like interactions.

**Architecture:** Mobile-only layout (`lg:hidden`) rendered alongside the existing desktop layout. `useIsMobile` hook for JS-level device detection. `ResponsiveDialog` wraps Dialog/Drawer switching. `@use-gesture/react` for swipe gestures.

**Tech Stack:** vaul (Drawer), @use-gesture/react, sonner (undo toast), existing shadcn/ui + Radix UI + dnd-kit

**Design doc:** `docs/plans/2026-02-20-mobile-trip-detail-redesign.md`

---

## Phase 1: Foundation

### Task 1: Add vaul and Drawer component

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/components/ui/drawer.tsx`

**Step 1: Install vaul**

```bash
cd apps/web && bun add vaul && cd ../..
```

**Step 2: Create Drawer component**

Create `apps/web/components/ui/drawer.tsx` based on shadcn/ui Drawer pattern:

```tsx
"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "@/lib/utils";

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
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

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[92vh] flex-col rounded-t-[10px] border bg-background",
        className,
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] shrink-0 rounded-full bg-muted" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
);

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
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
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
```

**Step 3: Verify build**

```bash
bun run --filter @sugara/web build
```

Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock apps/web/components/ui/drawer.tsx
git commit -m "chore: vaul + Drawerコンポーネントを追加"
```

---

### Task 2: useIsMobile hook

**Files:**
- Create: `apps/web/lib/hooks/use-is-mobile.ts`
- Create: `apps/web/lib/__tests__/use-is-mobile.test.ts`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/use-is-mobile.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIsMobile } from "../hooks/use-is-mobile";

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: { matches: boolean }) => void> = [];
  const mql = {
    matches,
    addEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_: string, cb: (e: { matches: boolean }) => void) => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mql));
  return { mql, listeners };
}

describe("useIsMobile", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when viewport is narrow", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when viewport is wide", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when media query changes", () => {
    const { mql, listeners } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      mql.matches = true;
      for (const cb of listeners) cb({ matches: true });
    });
    expect(result.current).toBe(true);
  });

  it("cleans up listener on unmount", () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test -- lib/__tests__/use-is-mobile.test.ts
```

Expected: FAIL (module not found).

**Step 3: Implement useIsMobile**

Create `apps/web/lib/hooks/use-is-mobile.ts`:

```ts
import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    setIsMobile(mql.matches);

    function onChange(e: MediaQueryListEvent) {
      setIsMobile(e.matches);
    }

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/web test -- lib/__tests__/use-is-mobile.test.ts
```

Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add apps/web/lib/hooks/use-is-mobile.ts apps/web/lib/__tests__/use-is-mobile.test.ts
git commit -m "feat: useIsMobileフックを追加"
```

---

### Task 3: ResponsiveDialog component

**Files:**
- Create: `apps/web/components/ui/responsive-dialog.tsx`
- Create: `apps/web/lib/__tests__/responsive-dialog.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/responsive-dialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/use-is-mobile", () => ({
  useIsMobile: vi.fn(),
}));

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogClose,
} from "../../components/ui/responsive-dialog";
import { useIsMobile } from "../hooks/use-is-mobile";

const mockUseIsMobile = vi.mocked(useIsMobile);

describe("ResponsiveDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Dialog on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Test Title</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Test Desc</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <p>Dialog body</p>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose>Close</ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Test Title")).toBeDefined();
    expect(screen.getByText("Dialog body")).toBeDefined();
  });

  it("renders Drawer on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mobile Title</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <p>Drawer body</p>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Mobile Title")).toBeDefined();
    expect(screen.getByText("Drawer body")).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test -- lib/__tests__/responsive-dialog.test.tsx
```

**Step 3: Implement ResponsiveDialog**

Create `apps/web/components/ui/responsive-dialog.tsx`:

```tsx
"use client";

import * as React from "react";

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

function ResponsiveDialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <DrawerContent className={className} {...(props as React.ComponentProps<typeof DrawerContent>)}>
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

function ResponsiveDialogDescription({
  ...props
}: React.ComponentProps<typeof DialogDescription>) {
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
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/web test -- lib/__tests__/responsive-dialog.test.tsx
```

**Step 5: Commit**

```bash
git add apps/web/components/ui/responsive-dialog.tsx apps/web/lib/__tests__/responsive-dialog.test.tsx
git commit -m "feat: ResponsiveDialogコンポーネントを追加"
```

---

### Task 4: haptics utility

**Files:**
- Create: `apps/web/lib/haptics.ts`
- Create: `apps/web/lib/__tests__/haptics.test.ts`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/haptics.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { haptics } from "../haptics";

describe("haptics", () => {
  let vibrateSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vibrateSpy = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateSpy,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("light calls vibrate with short duration", () => {
    haptics.light();
    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it("heavy calls vibrate with pattern", () => {
    haptics.heavy();
    expect(vibrateSpy).toHaveBeenCalledWith([30, 10, 30]);
  });

  it("does not throw when vibrate is unavailable", () => {
    Object.defineProperty(navigator, "vibrate", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => haptics.light()).not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test -- lib/__tests__/haptics.test.ts
```

**Step 3: Implement haptics**

Create `apps/web/lib/haptics.ts`:

```ts
function vibrate(pattern: number | number[]): void {
  navigator?.vibrate?.(pattern);
}

export const haptics = {
  light: () => vibrate(10),
  medium: () => vibrate(20),
  heavy: () => vibrate([30, 10, 30]),
  success: () => vibrate([10, 50, 10]),
  error: () => vibrate([50, 30, 50, 30, 50]),
} as const;
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/web test -- lib/__tests__/haptics.test.ts
```

**Step 5: Commit**

```bash
git add apps/web/lib/haptics.ts apps/web/lib/__tests__/haptics.test.ts
git commit -m "feat: hapticフィードバックユーティリティを追加"
```

---

### Task 5: Add @use-gesture/react

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install**

```bash
cd apps/web && bun add @use-gesture/react && cd ../..
```

**Step 2: Verify build**

```bash
bun run --filter @sugara/web build
```

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock
git commit -m "chore: @use-gesture/reactを追加"
```

---

## Phase 2: Layout Restructure

### Task 6: Compact mobile TripHeader

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/trip-header.tsx`
- Modify: `apps/web/components/trip-actions.tsx`

**Goal:** On mobile, TripHeader renders as a single 44px row: back button + title + presence + "..." menu. TripActions items move into the "..." menu.

**Step 1: Modify TripHeader**

Add `useIsMobile` import and conditional rendering:

```tsx
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
```

Wrap the existing TripHeader rendering in a desktop/mobile branch:

- Mobile (`isMobile`): Single row with `ArrowLeft` back button (links to `/home`), truncated `h1` title, `PresenceAvatars`, and `DropdownMenu` trigger ("..." button)
  - The "..." dropdown contains: status display, member count + open member dialog, share link, export, print, edit, delete (with existing AlertDialog)
  - Remove the standalone "候補" button entirely (replaced by content tabs in Task 7)
  - Total height: `h-11` (44px)
- Desktop: existing layout unchanged

**Step 2: Verify build and manual test**

```bash
bun run --filter @sugara/web build
```

Open on mobile viewport in browser dev tools and verify compact header.

**Step 3: Commit**

```bash
git add apps/web/app/(authenticated)/trips/[id]/_components/trip-header.tsx apps/web/components/trip-actions.tsx
git commit -m "feat: モバイル用コンパクトTripHeaderを実装"
```

---

### Task 7: Mobile content tabs

**Files:**
- Create: `apps/web/components/mobile-content-tabs.tsx`
- Create: `apps/web/lib/__tests__/mobile-content-tabs.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/mobile-content-tabs.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MobileContentTabs, type MobileContentTab } from "../../components/mobile-content-tabs";

describe("MobileContentTabs", () => {
  it("renders three tabs", () => {
    render(<MobileContentTabs activeTab="schedule" onTabChange={vi.fn()} candidateCount={0} />);
    expect(screen.getByRole("tab", { name: "予定" })).toBeDefined();
    expect(screen.getByRole("tab", { name: /候補/ })).toBeDefined();
    expect(screen.getByRole("tab", { name: /費用/ })).toBeDefined();
  });

  it("marks active tab as selected", () => {
    render(<MobileContentTabs activeTab="candidates" onTabChange={vi.fn()} candidateCount={3} />);
    const tab = screen.getByRole("tab", { name: /候補/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("calls onTabChange when tab is clicked", async () => {
    const onChange = vi.fn();
    render(<MobileContentTabs activeTab="schedule" onTabChange={onChange} candidateCount={0} />);
    await userEvent.click(screen.getByRole("tab", { name: /費用/ }));
    expect(onChange).toHaveBeenCalledWith("expenses");
  });

  it("shows candidate count badge", () => {
    render(<MobileContentTabs activeTab="schedule" onTabChange={vi.fn()} candidateCount={5} />);
    expect(screen.getByText("5")).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test -- lib/__tests__/mobile-content-tabs.test.tsx
```

**Step 3: Implement MobileContentTabs**

Create `apps/web/components/mobile-content-tabs.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { TAB_ACTIVE, TAB_INACTIVE } from "@/lib/styles";

export type MobileContentTab = "schedule" | "candidates" | "expenses";

interface MobileContentTabsProps {
  activeTab: MobileContentTab;
  onTabChange: (tab: MobileContentTab) => void;
  candidateCount: number;
}

const TABS: { id: MobileContentTab; label: string }[] = [
  { id: "schedule", label: "予定" },
  { id: "candidates", label: "候補" },
  { id: "expenses", label: "費用" },
];

export function MobileContentTabs({ activeTab, onTabChange, candidateCount }: MobileContentTabsProps) {
  return (
    <div className="flex shrink-0 border-b" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={cn(
            "relative flex-1 px-2 py-2.5 text-sm font-medium transition-colors",
            activeTab === tab.id ? TAB_ACTIVE : TAB_INACTIVE,
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
          {tab.id === "candidates" && candidateCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-xs">
              {candidateCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/web test -- lib/__tests__/mobile-content-tabs.test.tsx
```

**Step 5: Commit**

```bash
git add apps/web/components/mobile-content-tabs.tsx apps/web/lib/__tests__/mobile-content-tabs.test.tsx
git commit -m "feat: モバイル用コンテンツタブコンポーネントを追加"
```

---

### Task 8: Restructure trip detail page for mobile tabs

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/trip-dialogs.tsx` (remove `MobileCandidateDialog`)
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/right-panel.tsx` (extract shared content rendering)

This is the largest task. The goal is to integrate `MobileContentTabs` into the page and render different content based on the active tab.

**Step 1: Add state and imports to page.tsx**

Add to `page.tsx`:
```tsx
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { MobileContentTabs, type MobileContentTab } from "@/components/mobile-content-tabs";

// Inside TripDetailPage:
const isMobile = useIsMobile();
const [mobileTab, setMobileTab] = useState<MobileContentTab>("schedule");
const scrollPositions = useRef<Record<string, number>>({});
const mobileContentRef = useRef<HTMLDivElement>(null);
```

**Step 2: Add scroll position preservation**

```tsx
function handleMobileTabChange(tab: MobileContentTab) {
  if (mobileContentRef.current) {
    scrollPositions.current[mobileTab] = mobileContentRef.current.scrollTop;
  }
  setMobileTab(tab);
  requestAnimationFrame(() => {
    mobileContentRef.current?.scrollTo(0, scrollPositions.current[tab] ?? 0);
  });
}
```

**Step 3: Add mobile layout**

Below the existing `<div className="flex items-start gap-4">` desktop layout, add a mobile layout wrapped in `{isMobile && (...)}`  with `lg:hidden`:

```tsx
{/* Mobile layout */}
<div className="lg:hidden">
  <MobileContentTabs
    activeTab={mobileTab}
    onTabChange={handleMobileTabChange}
    candidateCount={trip.candidates.length}
  />
  {mobileTab === "schedule" && (
    <>
      <DayTabs ... />
      {/* DayTimeline or PollTab depending on selectedDay */}
    </>
  )}
  {mobileTab === "candidates" && (
    <CandidatePanel tripId={tripId} candidates={trip.candidates} ... draggable={false} />
  )}
  {mobileTab === "expenses" && (
    <ExpensePanel tripId={tripId} canEdit={canEdit} />
  )}
</div>

{/* Desktop layout - unchanged, hidden on mobile */}
<div className="hidden lg:flex items-start gap-4">
  {/* existing left panel + right panel */}
</div>
```

**Step 4: Remove MobileCandidateDialog**

In `trip-dialogs.tsx`, remove the `MobileCandidateDialog` export and all its code. In `page.tsx`, remove the `candidateOpen` state and the `MobileCandidateDialog` render.

**Step 5: Remove "候補" button from TripHeader**

Remove the mobile candidate button (`lg:hidden`) from `trip-header.tsx` and the `onCandidateOpen` prop.

**Step 6: Verify build and test**

```bash
bun run --filter @sugara/web build
bun run --filter @sugara/web test
```

**Step 7: Manual test on mobile viewport**

- Open browser dev tools, set to iPhone viewport
- Navigate to a trip with schedules, candidates, and expenses
- Verify tab switching works
- Verify scroll position is preserved when switching tabs
- Verify desktop layout is unchanged at `lg:` breakpoint

**Step 8: Commit**

```bash
git add apps/web/app/(authenticated)/trips/[id]/page.tsx \
  apps/web/app/(authenticated)/trips/[id]/_components/trip-dialogs.tsx \
  apps/web/app/(authenticated)/trips/[id]/_components/trip-header.tsx
git commit -m "feat: モバイル版タブベースレイアウトを実装、MobileCandidateDialogを削除"
```

---

### Task 9: FAB (Floating Action Button)

**Files:**
- Create: `apps/web/components/fab.tsx`
- Create: `apps/web/lib/__tests__/fab.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/fab.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Fab } from "../../components/fab";

describe("Fab", () => {
  it("renders with plus icon", () => {
    render(<Fab onClick={vi.fn()} label="予定を追加" />);
    expect(screen.getByRole("button", { name: "予定を追加" })).toBeDefined();
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Fab onClick={onClick} label="予定を追加" />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is hidden when hidden prop is true", () => {
    render(<Fab onClick={vi.fn()} label="予定を追加" hidden />);
    const btn = screen.queryByRole("button", { name: "予定を追加" });
    expect(btn).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test -- lib/__tests__/fab.test.tsx
```

**Step 3: Implement FAB**

Create `apps/web/components/fab.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface FabProps {
  onClick: () => void;
  label: string;
  hidden?: boolean;
  className?: string;
}

export function Fab({ onClick, label, hidden, className }: FabProps) {
  if (hidden) return null;

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 lg:hidden",
        className,
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px)" }}
      onClick={() => {
        haptics.light();
        onClick();
      }}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/web test -- lib/__tests__/fab.test.tsx
```

**Step 5: Integrate FAB into trip detail page**

In `page.tsx`, add FAB below the mobile layout:

```tsx
{isMobile && (
  <Fab
    onClick={() => {
      if (mobileTab === "schedule") setAddScheduleOpen(true);
      else if (mobileTab === "candidates") setAddCandidateOpen(true);
      // expenses: handled by ExpensePanel internally
    }}
    label={mobileTab === "schedule" ? "予定を追加" : mobileTab === "candidates" ? "候補を追加" : "費用を追加"}
    hidden={!canEdit || !online || scheduleLimitReached}
  />
)}
```

**Step 6: Verify build**

```bash
bun run --filter @sugara/web build
```

**Step 7: Commit**

```bash
git add apps/web/components/fab.tsx apps/web/lib/__tests__/fab.test.tsx apps/web/app/(authenticated)/trips/[id]/page.tsx
git commit -m "feat: FAB(フローティングアクションボタン)を追加"
```

---

### Task 10: Day picker Drawer for candidate assignment

**Files:**
- Create: `apps/web/components/day-picker-drawer.tsx`
- Create: `apps/web/lib/__tests__/day-picker-drawer.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/day-picker-drawer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DayPickerDrawer } from "../../components/day-picker-drawer";

const MOCK_DAYS = [
  { id: "d1", date: "2026-11-03", dayIndex: 0 },
  { id: "d2", date: "2026-11-04", dayIndex: 1 },
  { id: "d3", date: "2026-11-05", dayIndex: 2 },
];

describe("DayPickerDrawer", () => {
  it("renders day options", () => {
    render(
      <DayPickerDrawer
        open
        onOpenChange={vi.fn()}
        days={MOCK_DAYS}
        defaultDayIndex={0}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText(/1日目/)).toBeDefined();
    expect(screen.getByText(/2日目/)).toBeDefined();
    expect(screen.getByText(/3日目/)).toBeDefined();
  });

  it("pre-selects the default day", () => {
    render(
      <DayPickerDrawer
        open
        onOpenChange={vi.fn()}
        days={MOCK_DAYS}
        defaultDayIndex={1}
        onConfirm={vi.fn()}
      />,
    );
    const radio = screen.getByRole("radio", { name: /2日目/ });
    expect(radio).toBeChecked();
  });

  it("calls onConfirm with selected day id", async () => {
    const onConfirm = vi.fn();
    render(
      <DayPickerDrawer
        open
        onOpenChange={vi.fn()}
        days={MOCK_DAYS}
        defaultDayIndex={0}
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: /3日目/ }));
    await userEvent.click(screen.getByRole("button", { name: "追加する" }));
    expect(onConfirm).toHaveBeenCalledWith("d3", undefined);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test -- lib/__tests__/day-picker-drawer.test.tsx
```

**Step 3: Implement DayPickerDrawer**

Create `apps/web/components/day-picker-drawer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

interface DayOption {
  id: string;
  date: string;
  dayIndex: number;
}

interface PatternOption {
  id: string;
  label: string;
}

interface DayPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: DayOption[];
  defaultDayIndex: number;
  patterns?: PatternOption[];
  defaultPatternId?: string;
  onConfirm: (dayId: string, patternId: string | undefined) => void;
}

export function DayPickerDrawer({
  open,
  onOpenChange,
  days,
  defaultDayIndex,
  patterns,
  defaultPatternId,
  onConfirm,
}: DayPickerDrawerProps) {
  const [selectedDayId, setSelectedDayId] = useState(
    () => days[defaultDayIndex]?.id ?? days[0]?.id,
  );
  const [selectedPatternId, setSelectedPatternId] = useState(defaultPatternId);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>どの日に追加しますか？</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2" role="radiogroup">
          {days.map((day) => {
            const dateStr = format(parseISO(day.date), "M/d (E)", { locale: ja });
            return (
              <label
                key={day.id}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-3 hover:bg-accent"
              >
                <input
                  type="radio"
                  role="radio"
                  name="day"
                  aria-label={`${day.dayIndex + 1}日目`}
                  checked={selectedDayId === day.id}
                  onChange={() => setSelectedDayId(day.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  {day.dayIndex + 1}日目
                  <span className="ml-2 text-muted-foreground">{dateStr}</span>
                </span>
              </label>
            );
          })}
        </div>
        {patterns && patterns.length > 1 && (
          <div className="border-t px-4 py-3">
            <label className="text-xs text-muted-foreground">
              パターン
              <select
                className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={selectedPatternId}
                onChange={(e) => setSelectedPatternId(e.target.value)}
              >
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </label>
          </div>
        )}
        <DrawerFooter>
          <Button onClick={() => { onConfirm(selectedDayId, selectedPatternId); onOpenChange(false); }}>
            追加する
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/web test -- lib/__tests__/day-picker-drawer.test.tsx
```

**Step 5: Commit**

```bash
git add apps/web/components/day-picker-drawer.tsx apps/web/lib/__tests__/day-picker-drawer.test.tsx
git commit -m "feat: 候補→予定追加用の日選択Drawerを追加"
```

---

### Task 11: Pattern picker Drawer (mobile)

**Files:**
- Create: `apps/web/components/pattern-picker-drawer.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/pattern-tabs.tsx`

**Goal:** On mobile, replace the pattern tab row with a dropdown button in the DayTimeline toolbar. Tapping opens a Drawer with pattern list and management actions.

**Step 1: Create PatternPickerDrawer**

Create `apps/web/components/pattern-picker-drawer.tsx` as a Drawer listing patterns with:
- Radio buttons for pattern selection
- Each pattern has a "..." menu (rename/duplicate/delete)
- "パターンを追加" button at bottom

**Step 2: Modify pattern-tabs.tsx**

Add `useIsMobile()` check:
- Mobile: render a single button showing current pattern name + chevron. Tapping opens `PatternPickerDrawer`
- Desktop: existing pill row unchanged
- If only 1 pattern: render nothing on both mobile and desktop (existing behavior)

**Step 3: Verify build**

```bash
bun run --filter @sugara/web build
```

**Step 4: Commit**

```bash
git add apps/web/components/pattern-picker-drawer.tsx apps/web/app/(authenticated)/trips/[id]/_components/pattern-tabs.tsx
git commit -m "feat: モバイル用パターン選択Drawerを追加"
```

---

## Phase 3: Dialog Migration

Each dialog migration follows the same pattern. Replace `Dialog*` imports with `ResponsiveDialog*` imports.

### Task 12: Migrate AddScheduleDialog + EditScheduleDialog

**Files:**
- Modify: `apps/web/components/add-schedule-dialog.tsx`

**Step 1: Replace imports**

```tsx
// Before:
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";

// After:
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
  ResponsiveDialogClose,
} from "@/components/ui/responsive-dialog";
```

**Step 2: Replace JSX**

Replace all `<Dialog>` with `<ResponsiveDialog>`, `<DialogContent>` with `<ResponsiveDialogContent>`, etc. throughout the file.

**Step 3: Verify build and test**

```bash
bun run --filter @sugara/web build
bun run --filter @sugara/web test
```

**Step 4: Manual test**

Open on mobile viewport: confirm the form opens as a bottom sheet. Open on desktop: confirm it opens as a centered dialog.

**Step 5: Commit**

```bash
git add apps/web/components/add-schedule-dialog.tsx
git commit -m "feat: 予定追加/編集ダイアログをResponsiveDialogに移行"
```

---

### Task 13: Migrate AddCandidateDialog + EditCandidateDialog

**Files:**
- Modify: `apps/web/components/add-candidate-dialog.tsx`

Same pattern as Task 12. Replace Dialog -> ResponsiveDialog.

**Commit:**

```bash
git commit -m "feat: 候補追加/編集ダイアログをResponsiveDialogに移行"
```

---

### Task 14: Migrate ExpenseDialog

**Files:**
- Modify: `apps/web/components/expense-dialog.tsx`

Same pattern as Task 12.

**Commit:**

```bash
git commit -m "feat: 費用ダイアログをResponsiveDialogに移行"
```

---

### Task 15: Migrate MemberDialog

**Files:**
- Modify: `apps/web/components/member-dialog.tsx`

Same pattern as Task 12.

**Commit:**

```bash
git commit -m "feat: メンバーダイアログをResponsiveDialogに移行"
```

---

### Task 16: Migrate remaining dialogs

**Files:**
- Modify: `apps/web/components/create-trip-dialog.tsx`
- Modify: `apps/web/components/edit-trip-dialog.tsx`
- Modify: `apps/web/components/share-dialog.tsx`
- Modify: `apps/web/app/(authenticated)/trips/[id]/_components/trip-dialogs.tsx` (AddPattern, RenamePattern, DeletePattern, BatchDelete)

Same pattern for each. For AlertDialogs (delete, batch delete), create a `ResponsiveAlertDialog` variant or use Drawer with destructive button on mobile.

**Commit:**

```bash
git commit -m "feat: 残りのダイアログをResponsiveDialogに移行"
```

---

### Task 16.5: Run full test suite + type check

```bash
bun run test
bun run check-types
bun run check
```

Fix any issues found.

**Commit (if fixes needed):**

```bash
git commit -m "fix: ダイアログ移行後のテスト・型エラーを修正"
```

---

## Phase 4: Touch Interactions

### Task 17: SwipeableCard component

**Files:**
- Create: `apps/web/components/swipeable-card.tsx`
- Create: `apps/web/lib/__tests__/swipeable-card.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/lib/__tests__/swipeable-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SwipeableCard } from "../../components/swipeable-card";

describe("SwipeableCard", () => {
  it("renders children", () => {
    render(
      <SwipeableCard actions={[]}>
        <div>Card content</div>
      </SwipeableCard>,
    );
    expect(screen.getByText("Card content")).toBeDefined();
  });

  it("renders action buttons", () => {
    render(
      <SwipeableCard
        actions={[
          { label: "編集", color: "blue", onClick: vi.fn() },
          { label: "削除", color: "red", onClick: vi.fn() },
        ]}
      >
        <div>Card</div>
      </SwipeableCard>,
    );
    expect(screen.getByRole("button", { name: "編集" })).toBeDefined();
    expect(screen.getByRole("button", { name: "削除" })).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun run --filter @sugara/web test -- lib/__tests__/swipeable-card.test.tsx
```

**Step 3: Implement SwipeableCard**

Create `apps/web/components/swipeable-card.tsx`:

```tsx
"use client";

import { useRef, useState, type ReactNode } from "react";
import { useDrag } from "@use-gesture/react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface SwipeAction {
  label: string;
  icon?: ReactNode;
  color: "blue" | "red" | "green";
  onClick: () => void;
}

interface SwipeableCardProps {
  children: ReactNode;
  actions: SwipeAction[];
  disabled?: boolean;
  className?: string;
}

const ACTION_WIDTH = 72;
const EDGE_EXCLUSION = 20;
const ANGLE_THRESHOLD = 20;

const COLOR_MAP = {
  blue: "bg-blue-500 text-white",
  red: "bg-red-500 text-white",
  green: "bg-green-500 text-white",
} as const;

export function SwipeableCard({ children, actions, disabled, className }: SwipeableCardProps) {
  const [offset, setOffset] = useState(0);
  const revealed = useRef(false);
  const maxOffset = actions.length * ACTION_WIDTH;

  const bind = useDrag(
    ({ active, movement: [mx], xy: [startX], direction: [dx], first, memo }) => {
      if (disabled || actions.length === 0) return;

      // Edge exclusion: ignore touches near screen edges
      if (first && startX < EDGE_EXCLUSION) return;

      // Angle threshold: only register horizontal swipes
      if (first) {
        return { startOffset: revealed.current ? -maxOffset : 0 };
      }

      const startOffset = (memo as { startOffset: number })?.startOffset ?? 0;
      const newOffset = Math.max(-maxOffset, Math.min(0, startOffset + mx));

      if (active) {
        setOffset(newOffset);
      } else {
        // Snap to revealed or closed
        const threshold = maxOffset * 0.4;
        if (Math.abs(newOffset) > threshold) {
          setOffset(-maxOffset);
          revealed.current = true;
          haptics.light();
        } else {
          setOffset(0);
          revealed.current = false;
        }
      }

      return memo;
    },
    { axis: "x", filterTaps: true },
  );

  function close() {
    setOffset(0);
    revealed.current = false;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Action buttons behind the card */}
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            aria-label={action.label}
            className={cn("flex w-[72px] items-center justify-center", COLOR_MAP[action.color])}
            onClick={() => {
              action.onClick();
              close();
            }}
          >
            <div className="flex flex-col items-center gap-1">
              {action.icon}
              <span className="text-xs">{action.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Sliding card */}
      <div
        {...bind()}
        className="relative bg-background transition-transform duration-150 ease-out"
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: "pan-y",
          transitionDuration: offset === 0 || offset === -maxOffset ? "150ms" : "0ms",
        }}
        onClick={() => {
          if (revealed.current) close();
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
bun run --filter @sugara/web test -- lib/__tests__/swipeable-card.test.tsx
```

**Step 5: Commit**

```bash
git add apps/web/components/swipeable-card.tsx apps/web/lib/__tests__/swipeable-card.test.tsx
git commit -m "feat: スワイプアクション付きカードコンポーネントを追加"
```

---

### Task 18: Add swipe actions to schedule cards

**Files:**
- Modify: `apps/web/components/schedule-item.tsx`

**Step 1: Import SwipeableCard and useIsMobile**

```tsx
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { SwipeableCard } from "./swipeable-card";
import { Pencil, Trash2 } from "lucide-react";
```

**Step 2: Wrap PlaceCard in SwipeableCard on mobile**

In `PlaceCard`, wrap the existing card content with `SwipeableCard` when `isMobile && !disabled && !crossDayDisplay && !selectable`:

```tsx
const isMobile = useIsMobile();
const swipeActions = isMobile && !disabled && !crossDayDisplay && !selectable
  ? [
      { label: "編集", icon: <Pencil className="h-4 w-4" />, color: "blue" as const, onClick: () => setEditOpen(true) },
      { label: "削除", icon: <Trash2 className="h-4 w-4" />, color: "red" as const, onClick: handleDelete },
    ]
  : [];
```

Same for `TransportConnector`.

**Step 3: Verify build and test**

```bash
bun run --filter @sugara/web build
bun run --filter @sugara/web test
```

**Step 4: Commit**

```bash
git add apps/web/components/schedule-item.tsx
git commit -m "feat: スケジュールカードにスワイプアクションを追加"
```

---

### Task 19: Add swipe actions to candidate cards

**Files:**
- Modify: `apps/web/components/candidate-panel.tsx`

Same pattern as Task 18. Wrap `CandidateCard` with `SwipeableCard` on mobile:
- Actions: "予定に追加" (blue, opens DayPickerDrawer or fast-path), "削除" (red)

**Commit:**

```bash
git commit -m "feat: 候補カードにスワイプアクションを追加"
```

---

### Task 20: ActionSheet component

**Files:**
- Create: `apps/web/components/action-sheet.tsx`
- Create: `apps/web/lib/__tests__/action-sheet.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActionSheet } from "../../components/action-sheet";

describe("ActionSheet", () => {
  it("renders action buttons", () => {
    render(
      <ActionSheet
        open
        onOpenChange={vi.fn()}
        actions={[
          { label: "編集", onClick: vi.fn() },
          { label: "削除", onClick: vi.fn(), variant: "destructive" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "編集" })).toBeDefined();
    expect(screen.getByRole("button", { name: "削除" })).toBeDefined();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeDefined();
  });

  it("calls action onClick and closes", async () => {
    const onClick = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ActionSheet
        open
        onOpenChange={onOpenChange}
        actions={[{ label: "編集", onClick }]}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "編集" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

**Step 2: Implement ActionSheet**

Create `apps/web/components/action-sheet.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

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
        <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
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
            className="mt-2 h-12 w-full text-base"
            onClick={() => onOpenChange(false)}
          >
            キャンセル
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

**Step 3: Run tests**

```bash
bun run --filter @sugara/web test -- lib/__tests__/action-sheet.test.tsx
```

**Step 4: Commit**

```bash
git add apps/web/components/action-sheet.tsx apps/web/lib/__tests__/action-sheet.test.tsx
git commit -m "feat: ActionSheet(iOS風アクションメニュー)を追加"
```

---

### Task 21: Replace DropdownMenu with ActionSheet on mobile

**Files:**
- Modify: `apps/web/components/schedule-item.tsx` (`ScheduleMenu`)
- Modify: `apps/web/components/candidate-panel.tsx` (candidate menu)

**Step 1: In ScheduleMenu, add useIsMobile check**

- Mobile: "..." button opens `ActionSheet` (Drawer)
- Desktop: "..." button opens `DropdownMenu` (existing)

**Step 2: Same for CandidateCard menu**

**Step 3: Verify build and test**

```bash
bun run --filter @sugara/web build
bun run --filter @sugara/web test
```

**Step 4: Commit**

```bash
git add apps/web/components/schedule-item.tsx apps/web/components/candidate-panel.tsx
git commit -m "feat: モバイルでDropdownMenuをActionSheetに置換"
```

---

## Phase 5: Reorder & Polish

### Task 22: Reorder mode for mobile

**Files:**
- Modify: `apps/web/components/day-timeline.tsx`

**Step 1: Add reorder mode state**

```tsx
const [reorderMode, setReorderMode] = useState(false);
```

**Step 2: Add mobile toolbar button**

On mobile, show "並び替え" button. When active, show up/down arrow buttons on each card and a "完了" button in the toolbar.

**Step 3: Implement move handlers**

```tsx
function handleMoveUp(scheduleId: string) {
  const idx = schedules.findIndex((s) => s.id === scheduleId);
  if (idx <= 0) return;
  // Call reorder API with swapped positions
}

function handleMoveDown(scheduleId: string) {
  const idx = schedules.findIndex((s) => s.id === scheduleId);
  if (idx >= schedules.length - 1) return;
  // Call reorder API with swapped positions
}
```

**Step 4: Enable dnd-kit TouchSensor in reorder mode**

In `use-trip-drag-and-drop.ts`, configure `TouchSensor` with `activationConstraint: { delay: 200, tolerance: 5 }`.

**Step 5: Verify and commit**

```bash
bun run --filter @sugara/web build
bun run --filter @sugara/web test
git commit -m "feat: モバイル用並び替えモードを追加"
```

---

### Task 23: ResponsiveSelect component

**Files:**
- Create: `apps/web/components/ui/responsive-select.tsx`
- Create: `apps/web/lib/__tests__/responsive-select.test.tsx`

**Step 1: Write test**

Test that it renders a Drawer-based list picker on mobile and Radix Select on desktop.

**Step 2: Implement**

On mobile: trigger button showing current value. Tapping opens a Drawer with radio buttons for each option. On desktop: existing `Select` component.

**Step 3: Test and commit**

```bash
git commit -m "feat: ResponsiveSelectコンポーネントを追加"
```

---

### Task 24: Replace Radix Select with ResponsiveSelect

**Files:**
- Modify: `apps/web/components/add-schedule-dialog.tsx` (category, transport, color selects)
- Modify: `apps/web/components/trip-actions.tsx` (status select)
- Modify: `apps/web/components/member-dialog.tsx` (role select)

Replace `Select` / `SelectTrigger` / `SelectContent` / `SelectItem` with `ResponsiveSelect` in each file.

**Commit:**

```bash
git commit -m "feat: フォームのSelectをResponsiveSelectに置換"
```

---

### Task 25: Mobile date picker (Drawer + Calendar)

**Files:**
- Modify: `apps/web/components/create-trip-dialog.tsx`
- Modify: `apps/web/components/edit-trip-dialog.tsx`

On mobile, when the date picker trigger is clicked, open a Drawer containing the Calendar component with larger touch targets (`min-h-[44px]` per cell).

**Commit:**

```bash
git commit -m "feat: モバイル版日付選択をDrawer内カレンダーに変更"
```

---

### Task 26: Tab switch animation

**Files:**
- Modify: `apps/web/app/(authenticated)/trips/[id]/page.tsx`

Add horizontal slide animation on mobile tab switch:

```tsx
// Track direction for animation
const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");

function handleMobileTabChange(tab: MobileContentTab) {
  const tabs: MobileContentTab[] = ["schedule", "candidates", "expenses"];
  const currentIdx = tabs.indexOf(mobileTab);
  const newIdx = tabs.indexOf(tab);
  setSlideDirection(newIdx > currentIdx ? "right" : "left");
  // ... existing scroll position logic
}
```

CSS transition on the content wrapper:

```tsx
<div
  className="transition-transform duration-200 ease-out"
  style={{
    transform: slideDirection === "right" ? "translateX(0)" : "translateX(0)",
  }}
>
```

Alternatively, use a simple fade transition (`opacity` + `transition-opacity duration-150`).

**Commit:**

```bash
git commit -m "feat: モバイルタブ切替アニメーションを追加"
```

---

### Task 27: Empty state designs

**Files:**
- Modify: `apps/web/components/day-timeline.tsx` (schedule empty state)
- Modify: `apps/web/components/candidate-panel.tsx` (candidate empty state)
- Modify: `apps/web/components/expense-panel.tsx` (expense empty state)

Each empty state shows a message + action button that does the same thing as FAB.

**Commit:**

```bash
git commit -m "feat: 各タブの空状態デザインを改善"
```

---

### Task 28: Haptic feedback integration

**Files:**
- Modify: `apps/web/components/swipeable-card.tsx` (already has haptics.light)
- Modify: `apps/web/components/fab.tsx` (already has haptics.light)
- Modify: `apps/web/components/day-timeline.tsx` (reorder)
- Modify: `apps/web/components/action-sheet.tsx` (destructive actions)

Add `haptics.light()` / `haptics.heavy()` calls at the trigger points defined in the design doc.

**Commit:**

```bash
git commit -m "feat: 各操作にhapticフィードバックを追加"
```

---

### Task 29: Touch target size audit

**Files:**
- Modify: Various components

Audit all interactive elements on mobile for 44px minimum:

| Element | Current | Fix |
|---------|---------|-----|
| ScheduleMenu ("...") button | h-8 (32px) | Add `min-h-[44px] min-w-[44px]` on mobile |
| DayTimeline toolbar buttons | h-8 (32px) | Acceptable with icon-only (44px including padding) |
| DayTabs individual tabs | py-2 (36px) | Add `min-h-[44px]` |
| PatternTabs pills | py-1.5 (28px) | N/A on mobile (replaced by Drawer) |
| CandidateCard reaction buttons | Verify >= 44px touch target |

**Commit:**

```bash
git commit -m "fix: モバイルのタッチターゲットを44px以上に調整"
```

---

### Task 30: Final verification

**Step 1: Run all tests**

```bash
bun run test
```

**Step 2: Type check**

```bash
bun run check-types
```

**Step 3: Lint + format**

```bash
bun run check
```

**Step 4: Build**

```bash
bun run build
```

**Step 5: Real device testing checklist**

- [ ] iPhone SE (667px): tabs visible, content scrollable, FAB not overlapping
- [ ] iPhone 14+ (844px+): comfortable content area
- [ ] Android Chrome: haptics working, swipe actions smooth
- [ ] Drawer forms: keyboard doesn't overlap submit button
- [ ] Landscape orientation: no layout breaks
- [ ] Desktop (1024px+): no visual changes from current behavior
- [ ] Swipe doesn't conflict with iOS Safari back gesture
- [ ] Tab scroll position preserved on switch
- [ ] Candidate → schedule fast-path + undo toast

**Step 6: Commit any fixes**

```bash
git commit -m "fix: 最終検証で見つかった問題を修正"
```
