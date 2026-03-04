import { expect, test } from "./fixtures/auth";

test.describe("Settings", () => {
  test("displays user ID", async ({ authenticatedPage: page }) => {
    await page.goto("/my");
    const userId = await page.locator('[data-testid="user-id"]').textContent();
    expect(userId).toBeTruthy();
    // UUID format
    expect(userId).toMatch(/^[a-f0-9-]{36}$/);
  });

  test("updates display name", async ({ authenticatedPage: page }) => {
    await page.goto("/my/edit");

    const nameInput = page.locator("#name");
    await nameInput.fill("Updated Name");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("プロフィールを更新しました")).toBeVisible();
  });

  test("updates username", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "アカウント" }).click();
    await expect(page.locator("#username")).toBeVisible();

    const newUsername = `renamed_${Date.now()}`;
    await page.locator("#username").fill(newUsername);

    // The "更新" button inside the username section
    const usernameSection = page.locator("form:has(#username)");
    await usernameSection.getByRole("button", { name: "更新" }).click();
    await expect(page.getByText("ユーザー名を更新しました")).toBeVisible();
  });

  test("changes password", async ({
    authenticatedPage: page,
    userCredentials,
  }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "アカウント" }).click();
    await expect(page.getByText("パスワード変更")).toBeVisible();

    await page.locator("#currentPassword").fill(userCredentials.password);
    await page.locator("#newPassword").fill("NewPassword456!");
    await page.locator("#confirmPassword").fill("NewPassword456!");
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page.getByText("パスワードを変更しました")).toBeVisible({ timeout: 15000 });
  });
});
