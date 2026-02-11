import { expect, test } from "@playwright/test";

test.describe("Trip Management", () => {
  const email = `e2e-trip-${Date.now()}@test.com`;
  const password = "TestPassword123!";

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/auth/signup");
    await page.getByLabel("名前").fill("Trip Tester");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "アカウントを作成" }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("メールアドレス").fill(email);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
  });

  test("creates a new trip and sees it on detail page", async ({ page }) => {
    await page.getByRole("link", { name: "新規作成" }).click();
    await expect(page).toHaveURL(/\/trips\/new/);

    await page.getByLabel("旅行タイトル").fill("E2E Trip");
    await page.getByLabel("目的地").fill("Osaka");

    // Select date range on the first displayed calendar grid
    // Click day 10 then day 12 using the button text inside gridcells
    const firstGrid = page.getByRole("grid").first();
    await firstGrid.getByRole("button", { name: /10日/ }).click();
    await firstGrid.getByRole("button", { name: /12日/ }).click();

    await page.getByRole("button", { name: "作成" }).click();

    // Should redirect to trip detail
    await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(page.getByText("E2E Trip")).toBeVisible();
  });
});
