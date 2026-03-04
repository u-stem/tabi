import { expect, test } from "./fixtures/auth";

test.describe("Mobile layout", () => {
  test("BottomNav is visible with 5 nav links", async ({ authenticatedPage: page }) => {
    const bottomNav = page.locator("nav[aria-label='ボトムナビゲーション']");
    await expect(bottomNav).toBeVisible();

    const links = bottomNav.getByRole("link");
    await expect(links).toHaveCount(5);
    await expect(bottomNav.getByRole("link", { name: "ホーム" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "ブックマーク" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "フレンド" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "通知" })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "プロフィール" })).toBeVisible();
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

  test("SP header shows settings link", async ({ authenticatedPage: page }) => {
    const settingsLink = page.locator("header").getByRole("link", { name: "設定" });
    await expect(settingsLink).toBeVisible();
    await settingsLink.click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
  });

  test("Logout via settings navigates to landing page", async ({ authenticatedPage: page }) => {
    await page.goto("/sp/settings");
    await page.getByRole("button", { name: "ログアウト" }).click();
    await page.getByRole("button", { name: "ログアウト" }).last().click();
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });
});
