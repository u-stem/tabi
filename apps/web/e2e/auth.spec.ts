import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
  const username = `e2e_${Date.now()}`;
  const password = "TestPassword123!";
  const name = "E2E User";

  test("sign up, log out, and log in", async ({ page }) => {
    // Sign up
    await page.goto("/auth/signup");
    await page.getByLabel("ユーザー名").fill(username);
    await page.getByLabel("表示名").fill(name);
    await page.getByLabel("パスワード", { exact: true }).fill(password);
    await page.getByLabel("パスワード（確認）").fill(password);
    await page.getByRole("button", { name: "新規登録" }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });

    // Log out via header dropdown (button text is "X ユーザーメニュー")
    await page.getByRole("button", { name: /ユーザーメニュー/ }).click();
    await page.getByRole("menuitem", { name: "ログアウト" }).click();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Log in
    await page.goto("/auth/login");
    await page.getByLabel("ユーザー名").fill(username);
    await page.getByLabel("パスワード").fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
  });
});
