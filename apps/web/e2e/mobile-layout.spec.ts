import { expect, test } from "./fixtures/auth";

test.describe("Mobile layout", () => {
  test("BottomNav is visible with 3 nav links", async ({ authenticatedPage: page }) => {
    const bottomNav = page.locator("nav[aria-label='ボトムナビゲーション']");
    await expect(bottomNav).toBeVisible();

    const links = bottomNav.getByRole("link");
    await expect(links).toHaveCount(3);
    await expect(bottomNav.getByRole("link", { name: "ホーム" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "ブックマーク" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "フレンド" })).toBeVisible();
  });

  test("BottomNav links navigate to correct pages", async ({ authenticatedPage: page }) => {
    const bottomNav = page.locator("nav[aria-label='ボトムナビゲーション']");

    await bottomNav.getByRole("link", { name: "フレンド" }).click();
    await expect(page).toHaveURL(/\/friends/);

    await bottomNav.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);
  });

  test("Header desktop nav links are hidden on mobile", async ({
    authenticatedPage: page,
  }) => {
    const headerNav = page.locator("header nav[aria-label='メインナビゲーション']");
    await expect(headerNav.getByRole("link", { name: "ホーム" })).toBeHidden();
    await expect(headerNav.getByRole("link", { name: "フレンド" })).toBeHidden();
  });

  test("Mobile Sheet menu opens with settings and logout", async ({
    authenticatedPage: page,
  }) => {
    // Mobile menu button (sm:hidden variant)
    const menuButton = page.locator("header").getByRole("button", { name: "ユーザーメニュー" });
    await menuButton.click();

    const mobileMenu = page.locator("nav[aria-label='モバイルメニュー']");
    await expect(mobileMenu).toBeVisible();
    await expect(mobileMenu.getByRole("link", { name: "設定" })).toBeVisible();
    await expect(mobileMenu.getByRole("button", { name: "ログアウト" })).toBeVisible();
  });

  test("Logout via Sheet navigates to landing page", async ({ authenticatedPage: page }) => {
    const menuButton = page.locator("header").getByRole("button", { name: "ユーザーメニュー" });
    await menuButton.click();

    const mobileMenu = page.locator("nav[aria-label='モバイルメニュー']");
    await mobileMenu.getByRole("button", { name: "ログアウト" }).click();

    await expect(page).toHaveURL("/", { timeout: 10000 });
  });
});
