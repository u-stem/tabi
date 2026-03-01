import { expect, test } from "@playwright/test";

test.describe("Static Pages", () => {
  test("landing page loads with heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10000 });
  });

  test("FAQ page loads with content", async ({ page }) => {
    await page.goto("/faq");
    await expect(page).toHaveURL(/\/faq/);
    await expect(page.getByRole("heading", { name: "よくある質問" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("terms of service page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveURL(/\/terms/);
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("privacy policy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("news page loads", async ({ page }) => {
    await page.goto("/news");
    await expect(page).toHaveURL(/\/news/);
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("login page loads with form", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByRole("button", { name: "ログイン" })).toBeVisible({ timeout: 10000 });
  });
});
