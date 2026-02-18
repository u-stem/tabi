import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Patterns", () => {
  test("adds a new pattern", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Pattern Test",
      destination: "Hokkaido",
    });

    await page.getByRole("button", { name: "パターン追加" }).click();
    await page.locator("#pattern-label").fill("雨の日プラン");
    await page.getByRole("button", { name: "追加" }).click();

    await expect(page.getByText("パターンを追加しました")).toBeVisible();
    await expect(page.getByRole("button", { name: "雨の日プラン", exact: true })).toBeVisible();
  });

  test("renames a pattern", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Rename Pattern Test",
      destination: "Okinawa",
    });

    // Add a pattern first
    await page.getByRole("button", { name: "パターン追加" }).click();
    await page.locator("#pattern-label").fill("晴れの日プラン");
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("パターンを追加しました")).toBeVisible();

    // Open pattern dropdown menu via the MoreHorizontal button
    await page.getByRole("button", { name: "晴れの日プラン", exact: true }).click();
    await page.getByRole("button", { name: "晴れの日プランのメニュー" }).click();
    await page.getByRole("menuitem", { name: "名前変更" }).click();

    await page.locator("#rename-label").clear();
    await page.locator("#rename-label").fill("曇りの日プラン");
    await page.getByRole("button", { name: "変更" }).click();

    await expect(page.getByText("名前を変更しました")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "曇りの日プラン", exact: true }),
    ).toBeVisible();
  });

  test("deletes a pattern", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Delete Pattern Test",
      destination: "Fukuoka",
    });

    // Add a pattern first
    await page.getByRole("button", { name: "パターン追加" }).click();
    await page.locator("#pattern-label").fill("削除対象プラン");
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("パターンを追加しました")).toBeVisible();

    // Open pattern dropdown menu
    await page.getByRole("button", { name: "削除対象プラン", exact: true }).click();
    await page.getByRole("button", { name: "削除対象プランのメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();

    // Confirm deletion in the alert dialog
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("パターンを削除しました")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "削除対象プラン", exact: true }),
    ).not.toBeVisible();
    // Default pattern should still be visible
    await expect(page.getByRole("button", { name: "デフォルト", exact: true })).toBeVisible();
  });
});
