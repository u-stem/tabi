import { expect, test } from "./fixtures/auth";

test.describe("Settings", () => {
  test("displays user ID", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByText("ユーザーID")).toBeVisible();
    const userId = await page.locator("code").first().textContent();
    expect(userId).toBeTruthy();
    // UUID format
    expect(userId).toMatch(/^[a-f0-9-]{36}$/);
  });

  test("updates display name", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByText("プロフィール", { exact: true })).toBeVisible();

    const nameInput = page.getByLabel("表示名");
    await nameInput.fill("Updated Name");
    await page.getByRole("button", { name: "更新" }).first().click();
    await expect(page.getByText("プロフィールを更新しました")).toBeVisible();
  });

  test("updates username", async ({
    authenticatedPage: page,
    userCredentials,
  }) => {
    await page.goto("/settings");
    await expect(page.getByLabel("ユーザー名")).toBeVisible();

    const newUsername = `renamed_${Date.now()}`;
    const usernameInput = page.getByLabel("ユーザー名");
    await usernameInput.fill(newUsername);

    // The "更新" button inside the username section
    const usernameSection = page.locator("form", { has: page.getByLabel("ユーザー名") });
    await usernameSection.getByRole("button", { name: "更新" }).click();
    await expect(page.getByText("ユーザー名を更新しました")).toBeVisible();
  });

  test("changes password", async ({
    authenticatedPage: page,
    userCredentials,
  }) => {
    await page.goto("/settings");
    await expect(page.getByText("パスワード変更")).toBeVisible();

    await page.getByLabel("現在のパスワード").fill(userCredentials.password);
    await page.getByLabel("新しいパスワード", { exact: true }).fill("NewPassword456!");
    await page.getByLabel("新しいパスワード（確認）").fill("NewPassword456!");
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page.getByText("パスワードを変更しました")).toBeVisible();
  });
});
