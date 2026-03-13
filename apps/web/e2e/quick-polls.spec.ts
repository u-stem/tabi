import { expect, test } from "./fixtures/auth";

test.describe("Quick Polls", () => {
  test("creates a quick poll and shows share link", async ({ authenticatedPage: page }) => {
    await page.goto("/polls");

    await page.getByRole("button", { name: "新規作成" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.locator("#poll-question").fill("好きな季節は？");

    // Fill default two options
    await dialog.getByPlaceholder("選択肢 1").fill("春");
    await dialog.getByPlaceholder("選択肢 2").fill("夏");

    await dialog.getByRole("button", { name: "作成" }).click();

    // Share link phase should appear
    await expect(dialog.locator("input[readonly]")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("投票を作成しました")).toBeVisible();
  });

  test("creates a poll with multiple options", async ({ authenticatedPage: page }) => {
    await page.goto("/polls");

    await page.getByRole("button", { name: "新規作成" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.locator("#poll-question").fill("ランチ何にする？");
    await dialog.getByPlaceholder("選択肢 1").fill("ラーメン");
    await dialog.getByPlaceholder("選択肢 2").fill("カレー");

    // Add a third option
    await dialog.getByRole("button", { name: "追加" }).click();
    await dialog.getByPlaceholder("選択肢 3").fill("寿司");

    await dialog.getByRole("button", { name: "作成" }).click();
    await expect(page.getByText("投票を作成しました")).toBeVisible();
  });

  test("navigates to poll detail and closes poll", async ({ authenticatedPage: page }) => {
    await page.goto("/polls");

    // Create a poll first
    await page.getByRole("button", { name: "新規作成" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#poll-question").fill("テスト投票");
    await dialog.getByPlaceholder("選択肢 1").fill("A");
    await dialog.getByPlaceholder("選択肢 2").fill("B");
    await dialog.getByRole("button", { name: "作成" }).click();
    await expect(page.getByText("投票を作成しました")).toBeVisible();

    // Close share dialog
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();

    // Navigate to poll detail
    await page.getByRole("link", { name: /テスト投票/ }).click();
    await expect(page).toHaveURL(/\/polls\/[a-f0-9-]+/, { timeout: 10000 });

    // Close the poll
    await page.getByRole("button", { name: "投票を終了" }).click();
    await expect(page.getByText("投票を終了しました")).toBeVisible();
  });

  test("deletes a poll from detail page", async ({ authenticatedPage: page }) => {
    await page.goto("/polls");

    // Create a poll first
    await page.getByRole("button", { name: "新規作成" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#poll-question").fill("削除テスト");
    await dialog.getByPlaceholder("選択肢 1").fill("X");
    await dialog.getByPlaceholder("選択肢 2").fill("Y");
    await dialog.getByRole("button", { name: "作成" }).click();
    await expect(page.getByText("投票を作成しました")).toBeVisible();
    await page.keyboard.press("Escape");

    // Navigate to detail and delete
    await page.getByRole("link", { name: /削除テスト/ }).click();
    await expect(page).toHaveURL(/\/polls\/[a-f0-9-]+/, { timeout: 10000 });

    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByText("投票を削除しました")).toBeVisible();
    await expect(page).toHaveURL(/\/polls$/, { timeout: 10000 });
  });
});
