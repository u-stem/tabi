import { createTripWithPollViaUI, expect, test } from "./fixtures/auth";

test.describe("Polls", () => {
  test("adds and edits a poll note", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, { title: "Poll Note Test", destination: "Kyoto" });

    await page.getByRole("tab", { name: "日程調整" }).click();

    await page.getByRole("button", { name: "メモを追加" }).click();
    await page.getByRole("textbox").fill("日程候補についてのメモ");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("メモを更新しました")).toBeVisible();
    // The note is rendered as a <button> whose accessible name is the note text.
    await expect(page.getByRole("button", { name: "日程候補についてのメモ" })).toBeVisible();
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

    // Select a different date range from the existing poll option (20th-22nd)
    // NOTE: use hasText to match visible day numbers instead of aria-labels that include year
    const grid = dialog.getByRole("grid").first();
    await grid.getByRole("gridcell").filter({ hasText: "10" }).click();
    await grid.getByRole("gridcell").filter({ hasText: "12" }).click();

    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("日程案を追加しました")).toBeVisible();
  });

  test("deletes a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Delete Option Test",
      destination: "Nagano",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    await page.getByRole("button", { name: "日程案を削除" }).first().click();

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

    // Step 2: click the first date option button (contains month text to distinguish from close button)
    await selectDialog.getByRole("button").filter({ hasText: /月/ }).first().click();

    // Step 3: AlertDialog appears with final confirm button
    await page.getByRole("button", { name: "確定する" }).click();

    await expect(page.getByText("日程を確定しました")).toBeVisible();

    // After confirmation, trip gains day tabs (scheduling → draft with dates)
    await expect(page.getByRole("tab", { name: /1日目/ })).toBeVisible({ timeout: 10000 });
  });
});
