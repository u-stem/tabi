import { type Page, test as base, expect } from "@playwright/test";

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

const DEFAULT_PASSWORD = "TestPassword123!";

type AuthFixtures = {
  authenticatedPage: Page;
  userCredentials: { username: string; password: string; name: string };
};

export async function signupUser(
  page: Page,
  options: { username: string; name: string; password?: string },
): Promise<void> {
  await page.goto("/auth/signup");
  await page.getByLabel("ユーザー名").fill(options.username);
  await page.getByLabel("表示名").fill(options.name);
  const password = options.password ?? DEFAULT_PASSWORD;
  await page.locator("#password").fill(password);
  await page.locator("#confirmPassword").fill(password);
  await page.getByLabel("利用規約").check({ force: true });
  await page.getByRole("button", { name: "新規登録" }).click();
  await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
}

export const test = base.extend<AuthFixtures>({
  userCredentials: async ({}, use) => {
    const credentials = {
      username: `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      password: DEFAULT_PASSWORD,
      name: "E2E User",
    };
    await use(credentials);
  },

  authenticatedPage: async ({ page, userCredentials }, use) => {
    await signupUser(page, userCredentials);
    await use(page);
  },
});

export { expect } from "@playwright/test";

export async function createBookmarkListViaUI(
  page: Page,
  name: string,
): Promise<void> {
  await page.goto("/bookmarks");
  await page.getByRole("button", { name: "新規作成" }).click();
  await page.locator("#new-list-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByText("リストを作成しました")).toBeVisible();
}

export async function createGroupViaUI(
  page: Page,
  name: string,
): Promise<void> {
  await page.goto("/friends");
  await page
    .locator("div")
    .filter({ hasText: /^グループ/ })
    .getByRole("button", { name: "新規作成" })
    .click();
  await page.locator("#group-name").fill(name);
  await page.getByRole("button", { name: "作成" }).click();
  await expect(page.getByText("グループを作成しました")).toBeVisible();
}

export async function createTripViaUI(
  page: Page,
  options: { title: string; destination: string },
): Promise<string> {
  // Open create trip dialog
  await page.getByRole("button", { name: "新規作成" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.locator("#create-title").fill(options.title);
  await page.locator("#create-destination").fill(options.destination);

  // Select date range in the calendar
  const firstGrid = page.getByRole("grid").first();
  await firstGrid.getByRole("gridcell", { name: /10/ }).first().click();
  await firstGrid.getByRole("gridcell", { name: /12/ }).first().click();

  await page.getByRole("button", { name: "作成" }).click();
  await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });

  return page.url();
}
