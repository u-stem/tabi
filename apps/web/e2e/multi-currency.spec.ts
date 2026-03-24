import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Multi-currency", () => {
  test("creates trip with USD base currency", async ({ authenticatedPage: page }) => {
    await page.getByRole("button", { name: "新規作成" }).click();
    const dialog = page.getByRole("dialog", { name: "新しい旅行を作成" });
    await expect(dialog).toBeVisible();

    await dialog.locator("#create-title").fill("USD Trip");
    await dialog.locator("#create-destination").fill("New York");

    // Change currency to USD
    await dialog.locator("#create-currency").click();
    await page.getByRole("option", { name: /USD/ }).click();

    // Select date range
    const firstGrid = dialog.getByRole("grid").first();
    await firstGrid.getByRole("gridcell").filter({ hasText: "20" }).click();
    await firstGrid.getByRole("gridcell").filter({ hasText: "22" }).click();

    await dialog.getByRole("button", { name: "作成" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15000 });

    // Verify trip was created
    const tripLink = page.getByRole("link", { name: /USD Trip/ }).first();
    await expect(tripLink).toBeVisible({ timeout: 15000 });
  });

  test("shows currency selector in expense dialog", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Currency Expense Test", destination: "Tokyo" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await expect(dialog).toBeVisible();

    // Currency selector should exist
    await expect(dialog.locator("#expense-currency")).toBeVisible();
  });

  test("shows exchange rate input when foreign currency selected", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, { title: "Exchange Rate Test", destination: "Tokyo" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await expect(dialog).toBeVisible();

    // Change currency to USD (trip is JPY by default)
    await dialog.locator("#expense-currency").click();
    await page.getByRole("option", { name: /USD/ }).click();

    // Exchange rate input should appear
    await expect(dialog.locator("#expense-exchange-rate")).toBeVisible({ timeout: 10000 });
  });
});
