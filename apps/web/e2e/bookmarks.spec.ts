import { createBookmarkListViaUI, expect, test } from "./fixtures/auth";

test.describe("Bookmarks", () => {
  test("creates a bookmark list and navigates to it", async ({
    authenticatedPage: page,
  }) => {
    await createBookmarkListViaUI(page, "E2E Test List");
    await expect(page.getByText("E2E Test List")).toBeVisible();

    // Navigate to the list detail
    await page.getByText("E2E Test List").click();
    await expect(page).toHaveURL(/\/bookmarks\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(page.getByRole("heading", { name: "E2E Test List" })).toBeVisible();
  });

  test("adds a bookmark", async ({ authenticatedPage: page }) => {
    await createBookmarkListViaUI(page, "Add Bookmark Test");
    await page.getByText("Add Bookmark Test").click();
    await expect(page).toHaveURL(/\/bookmarks\/[a-f0-9-]+/, { timeout: 10000 });

    await page.getByRole("button", { name: "追加" }).click();
    await page.locator("#bookmark-name").fill("Test Bookmark");
    await page.getByRole("dialog").getByRole("button", { name: "追加" }).click();

    await expect(page.getByText("ブックマークを追加しました")).toBeVisible();
    await expect(page.getByText("Test Bookmark")).toBeVisible();
  });

  test("edits a bookmark via menu", async ({ authenticatedPage: page }) => {
    await createBookmarkListViaUI(page, "Edit Bookmark Test");
    await page.getByText("Edit Bookmark Test").click();
    await expect(page).toHaveURL(/\/bookmarks\/[a-f0-9-]+/, { timeout: 10000 });

    // Add a bookmark first
    await page.getByRole("button", { name: "追加" }).click();
    await page.locator("#bookmark-name").fill("Original Name");
    await page.getByRole("dialog").getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("ブックマークを追加しました")).toBeVisible();

    // Edit via menu
    await page.getByRole("button", { name: "Original Nameのメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.locator("#bookmark-name").clear();
    await page.locator("#bookmark-name").fill("Updated Name");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("ブックマークを更新しました")).toBeVisible();
    await expect(page.getByText("Updated Name")).toBeVisible();
  });

  test("deletes a bookmark via menu", async ({ authenticatedPage: page }) => {
    await createBookmarkListViaUI(page, "Delete Bookmark Test");
    await page.getByText("Delete Bookmark Test").click();
    await expect(page).toHaveURL(/\/bookmarks\/[a-f0-9-]+/, { timeout: 10000 });

    // Add a bookmark first
    await page.getByRole("button", { name: "追加" }).click();
    await page.locator("#bookmark-name").fill("To Be Deleted");
    await page.getByRole("dialog").getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("ブックマークを追加しました")).toBeVisible();

    // Delete via menu
    await page.getByRole("button", { name: "To Be Deletedのメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("ブックマークを削除しました")).toBeVisible();
    await expect(page.getByText("To Be Deleted")).not.toBeVisible();
  });

  test("edits a list name", async ({ authenticatedPage: page }) => {
    await createBookmarkListViaUI(page, "List Name Before");
    await page.getByText("List Name Before").click();
    await expect(page).toHaveURL(/\/bookmarks\/[a-f0-9-]+/, { timeout: 10000 });

    await page.getByRole("button", { name: "リストメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.locator("#edit-list-name").clear();
    await page.locator("#edit-list-name").fill("List Name After");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("リストを更新しました")).toBeVisible();
    await expect(page.getByRole("heading", { name: "List Name After" })).toBeVisible();
  });

  test("deletes a list", async ({ authenticatedPage: page }) => {
    await createBookmarkListViaUI(page, "List To Delete");
    await page.getByText("List To Delete").click();
    await expect(page).toHaveURL(/\/bookmarks\/[a-f0-9-]+/, { timeout: 10000 });

    await page.getByRole("button", { name: "リストメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("リストを削除しました")).toBeVisible();
    await expect(page).toHaveURL(/\/bookmarks$/, { timeout: 10000 });
  });
});
