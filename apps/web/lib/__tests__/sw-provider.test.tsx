import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/sw-provider", () => ({
  SwProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { SwProvider } from "../../components/sw-provider";

describe("SwProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("renders children", () => {
    render(
      <SwProvider swUrl="/sw.js">
        <p>child content</p>
      </SwProvider>,
    );
    expect(screen.getByText("child content")).toBeDefined();
  });
});
