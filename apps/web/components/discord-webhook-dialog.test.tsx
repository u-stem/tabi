import type { DiscordEnabledType } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/lib/test-utils";
import { DiscordWebhookDialog } from "./discord-webhook-dialog";

const mockApi = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => mockApi(...args),
  getApiErrorMessage: (_err: unknown, defaultMsg: string) => defaultMsg,
}));

const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({ data: undefined, isLoading: false, error: null })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
    setQueryData: vi.fn(),
  })),
}));

// ResponsiveDialog renders Dialog on desktop; stub useMobile to return false
vi.mock("@/lib/hooks/use-is-mobile", () => ({
  useMobile: () => false,
}));

const webhookFixture = {
  id: "wh-1",
  maskedUrl: "https://discord.com/api/webhooks/***",
  enabledTypes: ["member_added", "member_removed"] as DiscordEnabledType[],
  isActive: true,
  lastSuccessAt: null,
  failureCount: 0,
};

describe("DiscordWebhookDialog", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe("handleUpdate", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue({
        data: webhookFixture,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useQuery>);
    });

    it("saves changes and closes the dialog on success", async () => {
      const onOpenChange = vi.fn();
      mockApi.mockResolvedValueOnce({});

      renderWithIntl(
        <DiscordWebhookDialog
          tripId="trip-1"
          open={true}
          onOpenChange={onOpenChange}
          canEdit={true}
        />,
      );

      // Toggle a type to create a change (add "role_changed")
      const roleSwitch = screen.getByRole("switch", {
        name: /ロール変更/,
      });
      fireEvent.click(roleSwitch);

      // Click save button
      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith(
          "/api/trips/trip-1/discord-webhook",
          expect.objectContaining({ method: "PUT" }),
        );
      });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("keeps the dialog open on API error", async () => {
      const onOpenChange = vi.fn();
      mockApi.mockRejectedValueOnce(new Error("Network error"));

      renderWithIntl(
        <DiscordWebhookDialog
          tripId="trip-1"
          open={true}
          onOpenChange={onOpenChange}
          canEdit={true}
        />,
      );

      const roleSwitch = screen.getByRole("switch", {
        name: /ロール変更/,
      });
      fireEvent.click(roleSwitch);

      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalled();
      });

      // Dialog should NOT be closed on error
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });

  describe("handleCreate", () => {
    beforeEach(() => {
      vi.mocked(useQuery).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      } as ReturnType<typeof useQuery>);
    });

    it("creates webhook and closes the dialog on success", async () => {
      const onOpenChange = vi.fn();
      mockApi.mockResolvedValueOnce({});

      renderWithIntl(
        <DiscordWebhookDialog
          tripId="trip-1"
          open={true}
          onOpenChange={onOpenChange}
          canEdit={true}
        />,
      );

      // Fill in the webhook URL
      const urlInput = screen.getByRole("textbox");
      fireEvent.change(urlInput, {
        target: { value: "https://discord.com/api/webhooks/123/abc" },
      });

      // Submit the form
      const saveButton = screen.getByRole("button", { name: /保存/ });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockApi).toHaveBeenCalledWith(
          "/api/trips/trip-1/discord-webhook",
          expect.objectContaining({ method: "POST" }),
        );
      });

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
