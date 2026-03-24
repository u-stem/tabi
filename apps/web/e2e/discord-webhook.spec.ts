import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Discord Webhook", () => {
  test("opens Discord webhook dialog from trip menu", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Discord Test", destination: "Tokyo" });

    // Open trip menu
    await page.getByRole("button", { name: "旅行メニュー" }).click();

    // Click Discord menu item
    await page.getByRole("menuitem", { name: "Discord通知" }).click();

    // Verify dialog opens with title
    await expect(page.getByText("Discord通知").first()).toBeVisible({ timeout: 10000 });
  });

  test("shows setup form when no webhook configured", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Discord Setup Test", destination: "Osaka" });

    // Open trip menu -> Discord
    await page.getByRole("button", { name: "旅行メニュー" }).click();
    await page.getByRole("menuitem", { name: "Discord通知" }).click();

    // Verify Webhook URL input is visible
    await expect(page.locator("#webhook-url")).toBeVisible({ timeout: 10000 });

    // Verify save button is visible
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible();
  });
});
