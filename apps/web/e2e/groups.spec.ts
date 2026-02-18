import { createGroupViaUI, expect, test } from "./fixtures/auth";

test.describe("Groups", () => {
  test("creates a group", async ({ authenticatedPage: page }) => {
    await createGroupViaUI(page, "E2E Test Group");
    await expect(page.getByText("E2E Test Group")).toBeVisible();
  });

  test("renames a group", async ({ authenticatedPage: page }) => {
    await createGroupViaUI(page, "Before Rename");

    await page.getByRole("button", { name: "Before Renameのメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.locator("#edit-group-name").clear();
    await page.locator("#edit-group-name").fill("After Rename");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("グループ名を変更しました")).toBeVisible();
    await expect(page.getByText("After Rename")).toBeVisible();
  });

  test("deletes a group", async ({ authenticatedPage: page }) => {
    await createGroupViaUI(page, "To Be Deleted");

    await page.getByRole("button", { name: "To Be Deletedのメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("グループを削除しました")).toBeVisible();
    await expect(page.getByText("To Be Deleted")).not.toBeVisible();
  });
});
