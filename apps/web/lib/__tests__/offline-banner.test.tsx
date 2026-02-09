import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/use-online-status", () => ({
  useOnlineStatus: vi.fn(),
}));

import { OfflineBanner } from "../../components/offline-banner";
import { useOnlineStatus } from "../hooks/use-online-status";

const mockUseOnlineStatus = vi.mocked(useOnlineStatus);

describe("OfflineBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when online", () => {
    mockUseOnlineStatus.mockReturnValue(true);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner when offline", () => {
    mockUseOnlineStatus.mockReturnValue(false);
    render(<OfflineBanner />);
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("オフラインです")).toBeDefined();
  });
});
