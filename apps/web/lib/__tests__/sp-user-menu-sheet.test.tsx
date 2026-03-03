import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpUserMenuSheet } from "../../components/sp-user-menu-sheet";

vi.mock("../../lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: { name: "Test User", username: "testuser", displayUsername: null, image: null },
    },
  }),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/sp/home",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("../../lib/hooks/use-install-prompt", () => ({
  useInstallPrompt: () => ({ canInstall: false, promptInstall: vi.fn() }),
}));

describe("SpUserMenuSheet", () => {
  afterEach(cleanup);

  it("open=true のとき設定リンクが見える", () => {
    render(<SpUserMenuSheet open onOpenChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: /設定/ })).toBeDefined();
  });

  it("onOpenChange(false) がログアウト以外のリンクのクリックで呼ばれる", () => {
    const onOpenChange = vi.fn();
    render(<SpUserMenuSheet open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("link", { name: /設定/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("open=false のときコンテンツが描画されない", () => {
    render(<SpUserMenuSheet open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("link", { name: /設定/ })).toBeNull();
  });
});
