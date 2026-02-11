import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Dashboard", () => {
  test("searches trips by title", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Tokyo Trip", destination: "Tokyo" });
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);

    await createTripViaUI(page, { title: "Osaka Trip", destination: "Osaka" });
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);

    await createTripViaUI(page, {
      title: "Kyoto Trip",
      destination: "Kyoto",
    });
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);

    await expect(page.getByText("Tokyo Trip")).toBeVisible();
    await expect(page.getByText("Osaka Trip")).toBeVisible();
    await expect(page.getByText("Kyoto Trip")).toBeVisible();

    await page.getByLabel("旅行を検索").fill("Tokyo");
    await expect(page.getByText("Tokyo Trip")).toBeVisible();
    await expect(page.getByText("Osaka Trip")).not.toBeVisible();
    await expect(page.getByText("Kyoto Trip")).not.toBeVisible();
  });

  test("filters trips by status", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Draft Trip",
      destination: "Nara",
    });
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);

    await expect(page.getByText("Draft Trip")).toBeVisible();

    // New trips default to "draft" status, so filtering by "計画済み" should show nothing
    const statusSelect = page
      .getByRole("toolbar", { name: "旅行フィルター" })
      .getByRole("combobox")
      .first();
    await statusSelect.click();
    await page.getByRole("option", { name: "計画済み" }).click();

    await expect(
      page.getByText("条件に一致する旅行がありません"),
    ).toBeVisible();
  });

  test("sorts trips by start date", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Sort Trip",
      destination: "Matsumoto",
    });
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);

    // Default sort is by updated date; switch to start date
    const sortSelect = page
      .getByRole("toolbar", { name: "旅行フィルター" })
      .getByRole("combobox")
      .last();
    await sortSelect.click();
    await page.getByRole("option", { name: "出発日" }).click();

    // Trip should still be visible after sort change
    await expect(page.getByText("Sort Trip")).toBeVisible();
  });

  test("duplicates a trip", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Original Trip",
      destination: "Takayama",
    });
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);

    // Enter selection mode and select the trip
    await page
      .getByRole("toolbar", { name: "旅行フィルター" })
      .getByRole("button", { name: "選択" })
      .click();
    await page
      .getByRole("toolbar", { name: "選択操作" })
      .getByRole("button", { name: "全選択" })
      .click();
    await page
      .getByRole("toolbar", { name: "選択操作" })
      .getByRole("button", { name: "複製" })
      .click();

    await expect(page.getByText("1件の旅行を複製しました")).toBeVisible();
  });

  test("selects and deletes a trip", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Delete Me",
      destination: "Nowhere",
    });
    await page.getByRole("link", { name: "ホーム" }).click();
    await expect(page).toHaveURL(/\/home/);

    await expect(page.getByText("Delete Me")).toBeVisible();

    await page
      .getByRole("toolbar", { name: "旅行フィルター" })
      .getByRole("button", { name: "選択" })
      .click();
    await page
      .getByRole("toolbar", { name: "選択操作" })
      .getByRole("button", { name: "全選択" })
      .click();
    await page
      .getByRole("toolbar", { name: "選択操作" })
      .getByRole("button", { name: "削除" })
      .click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("Delete Me")).not.toBeVisible();
  });
});
