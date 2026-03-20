import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/lib/test-utils";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    requestPasswordReset: vi.fn().mockResolvedValue({ error: null }),
  },
}));

describe("ForgotPasswordPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("送信後は常に成功メッセージを表示する（メール未登録でも）", async () => {
    const { default: ForgotPasswordPage } = await import("./page");
    renderWithIntl(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/メールアドレス/), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /送信/ }));
    await waitFor(() => {
      expect(screen.getByText(/送信しました/)).toBeDefined();
    });
  });

  it("authClient.requestPasswordReset が呼ばれる", async () => {
    const { authClient } = await import("@/lib/auth-client");
    const { default: ForgotPasswordPage } = await import("./page");
    renderWithIntl(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText(/メールアドレス/), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /送信/ }));
    await waitFor(() => {
      expect(authClient.requestPasswordReset).toHaveBeenCalledWith({
        email: "test@example.com",
        redirectTo: "/auth/reset-password",
      });
    });
  });
});
