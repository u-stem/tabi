import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/use-is-mobile", () => ({
  useIsMobile: vi.fn(),
}));

import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "../../components/ui/responsive-dialog";
import { useIsMobile } from "../hooks/use-is-mobile";

const mockUseIsMobile = vi.mocked(useIsMobile);

describe("ResponsiveDialog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Dialog content on desktop", () => {
    mockUseIsMobile.mockReturnValue(false);
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Desktop Title</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Desktop Desc</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <p>Dialog body</p>
          <ResponsiveDialogFooter>
            <ResponsiveDialogClose>Close</ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Desktop Title")).toBeDefined();
    expect(screen.getByText("Dialog body")).toBeDefined();
  });

  it("renders Drawer content on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    render(
      <ResponsiveDialog open>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Mobile Title</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Mobile Desc</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <p>Drawer body</p>
        </ResponsiveDialogContent>
      </ResponsiveDialog>,
    );
    expect(screen.getByText("Mobile Title")).toBeDefined();
    expect(screen.getByText("Drawer body")).toBeDefined();
  });
});
