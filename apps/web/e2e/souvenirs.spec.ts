import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Souvenirs", () => {
  test("adds a souvenir with name only", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Add Test", destination: "Kyoto" });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    await expect(dialog).toBeVisible();
    await dialog.locator("#souvenir-name").fill("八つ橋");
    await dialog.getByRole("button", { name: "追加" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("八つ橋")).toBeVisible();
  });

  test("adds a souvenir with priority and recipient", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Full Test", destination: "Osaka" });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    await dialog.locator("#souvenir-name").fill("抹茶スイーツ");
    await dialog.locator("#souvenir-recipient").fill("お母さん");
    await dialog.getByRole("button", { name: "絶対" }).click();
    await dialog.locator("#souvenir-memo").fill("京都限定");
    await dialog.getByRole("button", { name: "追加" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("抹茶スイーツ")).toBeVisible();
  });

  test("shows add button disabled when name is empty", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Validation Test", destination: "Nara" });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    // Name is empty by default → add button is disabled
    await expect(dialog.getByRole("button", { name: "追加" })).toBeDisabled();
  });

  test("toggles souvenir purchased status", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Toggle Test", destination: "Sapporo" });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    await dialog.locator("#souvenir-name").fill("白い恋人");
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Toggle to purchased
    await page.getByRole("checkbox", { name: "購入済みにする" }).click();

    // Purchased section header should appear
    await expect(page.getByText(/購入済み/)).toBeVisible({ timeout: 5000 });

    // Expand the purchased section to verify the item moved there
    await page.getByText(/購入済み/).first().click();
    await expect(page.getByRole("checkbox", { name: "購入済みを取り消す" })).toBeVisible();
  });

  test("edits a souvenir", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Edit Test", destination: "Fukuoka" });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "お土産を追加" });
    await addDialog.locator("#souvenir-name").fill("明太子");
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "明太子のメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    const editDialog = page.getByRole("dialog", { name: "お土産を編集" });
    await expect(editDialog).toBeVisible();
    await editDialog.locator("#souvenir-name").clear();
    await editDialog.locator("#souvenir-name").fill("辛子明太子");
    await editDialog.getByRole("button", { name: "更新" }).click();

    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("辛子明太子")).toBeVisible();
    await expect(page.getByText("明太子", { exact: true })).not.toBeVisible();
  });

  test("deletes a souvenir", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Delete Test", destination: "Hiroshima" });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "お土産を追加" });
    await addDialog.locator("#souvenir-name").fill("もみじ饅頭");
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "もみじ饅頭のメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("もみじ饅頭")).not.toBeVisible();
  });

  test("bulk deletes souvenirs in selection mode", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Bulk Delete Test", destination: "Kobe" });

    await page.getByRole("tab", { name: "お土産" }).click();

    for (const name of ["神戸プリン", "スヌーピーグッズ"]) {
      await page.getByRole("button", { name: "お土産を追加" }).click();
      const d = page.getByRole("dialog", { name: "お土産を追加" });
      await d.locator("#souvenir-name").fill(name);
      await d.getByRole("button", { name: "追加" }).click();
      await expect(d).not.toBeVisible({ timeout: 10000 });
    }

    await page.getByRole("button", { name: "選択" }).click();
    await page.getByRole("button", { name: "全選択" }).click();
    await page.getByRole("button", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("神戸プリン")).not.toBeVisible();
    await expect(page.getByText("スヌーピーグッズ")).not.toBeVisible();
  });

  test("sorts souvenirs", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Souvenir Sort Test", destination: "Nagoya" });

    await page.getByRole("tab", { name: "お土産" }).click();

    await page.getByRole("button", { name: "お土産を追加" }).click();
    const d1 = page.getByRole("dialog", { name: "お土産を追加" });
    await d1.locator("#souvenir-name").fill("ういろう");
    await d1.getByRole("button", { name: "追加" }).click();
    await expect(d1).not.toBeVisible({ timeout: 10000 });

    // Default sort is priority order → button label says "作成順に切り替える"
    await expect(page.getByRole("button", { name: "作成順に切り替える" })).toBeVisible();
    await page.getByRole("button", { name: "作成順に切り替える" }).click();

    // Now in created order → button label says "優先度順に切り替える"
    await expect(page.getByRole("button", { name: "優先度順に切り替える" })).toBeVisible();

    // Switch back to priority order
    await page.getByRole("button", { name: "優先度順に切り替える" }).click();
    await expect(page.getByRole("button", { name: "作成順に切り替える" })).toBeVisible();
  });
});
