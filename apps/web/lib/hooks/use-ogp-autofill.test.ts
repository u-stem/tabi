import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOgpAutofill } from "./use-ogp-autofill";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}));

import { api } from "@/lib/api";

const mockApi = vi.mocked(api);

describe("useOgpAutofill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when URL is empty", () => {
    const onTitleFetched = vi.fn();
    renderHook(() => useOgpAutofill({ url: "", name: "", onTitleFetched }));
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("does not fetch when name is already filled", () => {
    const onTitleFetched = vi.fn();
    renderHook(() =>
      useOgpAutofill({
        url: "https://example.com",
        name: "Existing",
        onTitleFetched,
      }),
    );
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("does not fetch for non-HTTPS URLs", () => {
    const onTitleFetched = vi.fn();
    renderHook(() =>
      useOgpAutofill({
        url: "http://example.com",
        name: "",
        onTitleFetched,
      }),
    );
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("fetches OGP title when URL is valid and name is empty", async () => {
    mockApi.mockResolvedValueOnce({ title: "Fetched Title" });
    const onTitleFetched = vi.fn();

    renderHook(() =>
      useOgpAutofill({
        url: "https://example.com",
        name: "",
        onTitleFetched,
      }),
    );

    await waitFor(() => {
      expect(onTitleFetched).toHaveBeenCalledWith("Fetched Title");
    });
  });

  it("does not call onTitleFetched when fetch fails", async () => {
    mockApi.mockRejectedValueOnce(new Error("Network error"));
    const onTitleFetched = vi.fn();

    renderHook(() =>
      useOgpAutofill({
        url: "https://example.com",
        name: "",
        onTitleFetched,
      }),
    );

    // Wait for debounce + fetch to settle
    await new Promise((r) => setTimeout(r, 700));
    expect(onTitleFetched).not.toHaveBeenCalled();
  });
});
