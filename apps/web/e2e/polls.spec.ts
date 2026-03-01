import { createTripWithPollViaUI, expect, test } from "./fixtures/auth";

test.describe("Polls", () => {
  test("adds and edits a poll note", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, { title: "Poll Note Test", destination: "Kyoto" });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // The memo button shows "メモを追加" as its text content
    await page.getByText("メモを追加").click();
    await page.getByRole("textbox").fill("日程候補についてのメモ");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("メモを更新しました")).toBeVisible();
    await expect(page.getByText("日程候補についてのメモ")).toBeVisible();
  });

  test("adds a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Option Test",
      destination: "Osaka",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // Desktop toolbar button: visible when isOwner && isOpen && !isMobile
    await page.getByRole("button", { name: "日程案追加" }).click();

    const dialog = page.getByRole("dialog", { name: "日程案を追加" });
    await expect(dialog).toBeVisible();

    // Select a different date range than the one already added (10th-12th)
    const grid = dialog.getByRole("grid").first();
    await grid.getByRole("gridcell", { name: /20/ }).first().click();
    await grid.getByRole("gridcell", { name: /22/ }).first().click();

    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("日程案を追加しました")).toBeVisible();
  });

  test("deletes a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Delete Option Test",
      destination: "Nagano",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // The delete button is a ghost icon button with Trash2 icon, no aria-label
    // Only visible for isOwner && isOpen && !isMobile
    await page.locator("button:has(.lucide-trash-2)").first().click();

    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("日程案を削除しました")).toBeVisible();
  });

  test("confirms a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Confirm Test",
      destination: "Sendai",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // Step 1: click 確定 → option select dialog opens
    await page.getByRole("button", { name: "確定" }).click();

    const selectDialog = page.getByRole("dialog", { name: "日程を確定" });
    await expect(selectDialog).toBeVisible();

    // Step 2: click the first date option (button with date text, no aria-label)
    await selectDialog.getByRole("button").first().click();

    // Step 3: AlertDialog appears with final confirm button
    await page.getByRole("button", { name: "確定する" }).click();

    await expect(page.getByText("日程を確定しました")).toBeVisible();

    // After confirmation, trip gains day tabs (scheduling → draft with dates)
    await expect(page.getByRole("tab", { name: /1日目/ })).toBeVisible({ timeout: 10000 });
  });
});
