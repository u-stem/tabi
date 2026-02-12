import { type Page, test as base, expect } from "@playwright/test";

type AuthFixtures = {
  authenticatedPage: Page;
  userCredentials: { username: string; password: string; name: string };
};

export const test = base.extend<AuthFixtures>({
  userCredentials: async ({}, use) => {
    const credentials = {
      username: `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      password: "TestPassword123!",
      name: "E2E User",
    };
    await use(credentials);
  },

  authenticatedPage: async ({ page, userCredentials }, use) => {
    await page.goto("/auth/signup");
    await page.getByLabel("ユーザー名").fill(userCredentials.username);
    await page.getByLabel("表示名").fill(userCredentials.name);
    await page.getByLabel("パスワード", { exact: true }).fill(userCredentials.password);
    await page.getByLabel("パスワード（確認）").fill(userCredentials.password);
    await page.getByRole("button", { name: "新規登録" }).click();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
    await use(page);
  },
});

export { expect } from "@playwright/test";

export async function createTripViaUI(
  page: Page,
  options: { title: string; destination: string },
): Promise<string> {
  await page.getByRole("link", { name: "新規作成" }).click();
  await expect(page).toHaveURL(/\/trips\/new/);

  await page.getByLabel("旅行タイトル").fill(options.title);
  await page.getByLabel("目的地").fill(options.destination);

  const firstGrid = page.getByRole("grid").first();
  await firstGrid.getByRole("button", { name: /10日/ }).click();
  await firstGrid.getByRole("button", { name: /12日/ }).click();

  await page.getByRole("button", { name: "作成" }).click();
  await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });

  return page.url();
}
