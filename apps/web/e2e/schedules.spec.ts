import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Schedules", () => {
  test("adds a schedule to the timeline", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Schedule Test",
      destination: "Kyoto",
    });

    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("金閣寺");
    await page.getByRole("button", { name: "予定を追加" }).last().click();

    await expect(page.getByText("予定を追加しました")).toBeVisible();
    await expect(page.getByText("金閣寺")).toBeVisible();
  });

  test("edits a schedule", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Edit Schedule Test",
      destination: "Nara",
    });

    // Add a schedule first
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("東大寺");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    // Open schedule menu and edit
    await page.getByRole("button", { name: "東大寺のメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    await page.locator("#edit-name").clear();
    await page.locator("#edit-name").fill("春日大社");
    await page.getByRole("button", { name: "予定を更新" }).click();

    await expect(page.getByText("予定を更新しました")).toBeVisible();
    await expect(page.getByText("春日大社")).toBeVisible();
  });

  test("deletes a schedule", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Delete Schedule Test",
      destination: "Osaka",
    });

    // Add a schedule first
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("大阪城");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    // Open schedule menu and delete
    await page.getByRole("button", { name: "大阪城のメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("予定を削除しました")).toBeVisible();
    await expect(page.getByText("大阪城")).not.toBeVisible();
  });
});
