import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Expenses", () => {
  test("adds an expense with equal split", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Add Test", destination: "Tokyo" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await expect(dialog).toBeVisible();
    await dialog.locator("#expense-title").fill("夕食");
    await dialog.locator("#expense-amount").fill("3000");

    // Select payer via combobox
    await dialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();

    // Equal split is default
    await expect(dialog.getByRole("tab", { name: "均等" })).toHaveAttribute(
      "data-state",
      "active",
    );

    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("夕食")).toBeVisible();
  });

  test("adds an expense with custom split", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Custom Test", destination: "Osaka" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await dialog.locator("#expense-title").fill("スカーフ代");
    await dialog.locator("#expense-amount").fill("2000");

    await dialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();

    // Switch to custom split
    await dialog.getByRole("tab", { name: "カスタム" }).click();

    // Enter custom amount equal to total (only one member - self)
    const customInput = dialog.locator('input[type="number"]').last();
    await customInput.fill("2000");

    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("スカーフ代")).toBeVisible();
  });

  test("shows add button disabled when custom split total mismatches amount", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Expense Validation Test",
      destination: "Kyoto",
    });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await dialog.locator("#expense-title").fill("ランチ");
    await dialog.locator("#expense-amount").fill("5000");

    await dialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();

    await dialog.getByRole("tab", { name: "カスタム" }).click();

    // Enter wrong amount (mismatch)
    const customInput = dialog.locator('input[type="number"]').last();
    await customInput.fill("3000");

    // Add button should be disabled due to mismatch
    await expect(dialog.getByRole("button", { name: "追加" })).toBeDisabled();
    await expect(dialog.getByText("(残り 2,000円)")).toBeVisible();
  });

  test("edits an expense", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Edit Test", destination: "Nara" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "費用を追加" });
    await addDialog.locator("#expense-title").fill("交通費");
    await addDialog.locator("#expense-amount").fill("1000");
    await addDialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("交通費")).toBeVisible();

    // Edit the expense
    await page.getByRole("button", { name: "交通費のメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    const editDialog = page.getByRole("dialog", { name: "費用を編集" });
    await expect(editDialog).toBeVisible();
    await editDialog.locator("#expense-title").clear();
    await editDialog.locator("#expense-title").fill("電車代");
    await editDialog.getByRole("button", { name: "更新" }).click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("電車代")).toBeVisible();
    await expect(page.getByText("交通費")).not.toBeVisible();
  });

  test("deletes an expense", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Delete Test", destination: "Fukuoka" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "費用を追加" });
    await addDialog.locator("#expense-title").fill("宿泊費");
    await addDialog.locator("#expense-amount").fill("8000");
    await addDialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("宿泊費")).toBeVisible();

    await page.getByRole("button", { name: "宿泊費のメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("宿泊費")).not.toBeVisible();
  });

  test("shows settlement summary after adding expense", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Expense Settlement Test",
      destination: "Sapporo",
    });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "費用を追加" });
    await addDialog.locator("#expense-title").fill("観光費");
    await addDialog.locator("#expense-amount").fill("5000");
    await addDialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    // Settlement summary should be visible
    await expect(page.getByText("合計支出")).toBeVisible();
  });
});
