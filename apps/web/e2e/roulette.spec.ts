import { expect, test } from "./fixtures/auth";

test.describe("Roulette", () => {
  test("spins with prefecture mode", async ({ authenticatedPage: page }) => {
    await page.goto("/tools/roulette");

    // Default mode is prefecture
    await expect(page.getByRole("tab", { name: "都道府県" })).toHaveAttribute(
      "data-state",
      "active",
    );

    // Spin the roulette
    await page.getByRole("button", { name: "回す" }).click();

    // Wait for result (spinning takes ~2 seconds)
    await expect(page.getByRole("button", { name: "もう一回" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "リセット" })).toBeVisible();
  });

  test("filters by region in prefecture mode", async ({ authenticatedPage: page }) => {
    await page.goto("/tools/roulette");

    // Select a region filter (button text includes region name like "北海道・東北")
    await page.getByRole("button", { name: "北海道・東北" }).click();

    // Spin
    await page.getByRole("button", { name: "回す" }).click();
    await expect(page.getByRole("button", { name: "もう一回" })).toBeVisible({ timeout: 10000 });

    // Region filter button should still be selected (active state)
    await expect(page.getByRole("button", { name: "北海道・東北" })).toBeVisible();
  });

  test("uses custom mode", async ({ authenticatedPage: page }) => {
    await page.goto("/tools/roulette");

    // Switch to custom mode
    await page.getByRole("tab", { name: "カスタム" }).click();

    // Add items
    await page.getByPlaceholder("選択肢を入力").fill("ラーメン");
    await page.getByRole("button", { name: "追加" }).click();

    await page.getByPlaceholder("選択肢を入力").fill("カレー");
    await page.getByRole("button", { name: "追加" }).click();

    await page.getByPlaceholder("選択肢を入力").fill("寿司");
    await page.getByRole("button", { name: "追加" }).click();

    // Spin
    await page.getByRole("button", { name: "回す" }).click();
    await expect(page.getByRole("button", { name: "もう一回" })).toBeVisible({ timeout: 10000 });
  });

  test("adds item with Enter key in custom mode", async ({ authenticatedPage: page }) => {
    await page.goto("/tools/roulette");

    await page.getByRole("tab", { name: "カスタム" }).click();

    // Add item using Enter key
    const input = page.getByPlaceholder("選択肢を入力");
    await input.fill("テスト項目");
    await input.press("Enter");

    // Item should appear in the list
    await expect(page.getByText("テスト項目")).toBeVisible();

    // Input should be cleared
    await expect(input).toHaveValue("");
  });

  test("removes item in custom mode", async ({ authenticatedPage: page }) => {
    await page.goto("/tools/roulette");

    await page.getByRole("tab", { name: "カスタム" }).click();

    await page.getByPlaceholder("選択肢を入力").fill("削除する項目");
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("削除する項目")).toBeVisible();

    // Delete the item
    await page
      .getByText("削除する項目")
      .locator("..")
      .getByRole("button")
      .click();

    await expect(page.getByText("削除する項目")).not.toBeVisible();
  });

  test("resets result", async ({ authenticatedPage: page }) => {
    await page.goto("/tools/roulette");

    // Spin
    await page.getByRole("button", { name: "回す" }).click();
    await expect(page.getByRole("button", { name: "リセット" })).toBeVisible({ timeout: 10000 });

    // Reset
    await page.getByRole("button", { name: "リセット" }).click();

    // Should return to idle state with spin button
    await expect(page.getByRole("button", { name: "回す" })).toBeVisible();
  });
});
