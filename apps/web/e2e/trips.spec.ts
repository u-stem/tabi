import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Trip Management", () => {
  test("creates a new trip and sees it on detail page", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "E2E Trip",
      destination: "Osaka",
    });

    expect(tripUrl).toMatch(/\/trips\/[a-f0-9-]+/);
    await expect(page.getByText("E2E Trip")).toBeVisible();
  });

  test("edits trip title and destination", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Before Edit",
      destination: "Tokyo",
    });

    // Open trip menu -> edit
    await page.getByRole("button", { name: "旅行メニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.locator("#edit-title").clear();
    await page.locator("#edit-title").fill("After Edit");
    await page.locator("#edit-destination").clear();
    await page.locator("#edit-destination").fill("Yokohama");
    await page.getByRole("button", { name: "更新" }).click();

    await expect(page.getByText("旅行を更新しました")).toBeVisible();
    await expect(page.getByText("After Edit")).toBeVisible();
    await expect(page.getByText("Yokohama")).toBeVisible();
  });

  test("changes trip status", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Status Test",
      destination: "Nagano",
    });

    // Default status is "draft" (下書き) - change to "planned" (計画済み)
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "計画済み" }).click();

    await expect(page.getByText("ステータスを変更しました")).toBeVisible();
  });

  test("deletes a trip from detail page", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Delete From Detail",
      destination: "Hiroshima",
    });

    // Open trip menu -> delete
    await page.getByRole("button", { name: "旅行メニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("旅行を削除しました")).toBeVisible();
    await expect(page).toHaveURL(/\/home/, { timeout: 10000 });
  });
});
