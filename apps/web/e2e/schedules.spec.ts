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

  test("adds a schedule with all fields", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Full Schedule Test",
      destination: "Kyoto",
    });

    await page.getByRole("button", { name: "予定を追加" }).click();
    const dialog = page.locator("[role=dialog]");

    // Name
    await dialog.getByLabel("名前").fill("清水寺");

    // Category - use first combobox in the dialog
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "観光" }).click();

    // Color
    await dialog.getByRole("button", { name: "赤" }).click();

    // Address
    await dialog.getByLabel("住所").fill("京都市東山区清水1丁目");

    // URL
    await dialog.locator("input[type=url]").first().fill("https://www.kiyomizudera.or.jp/");

    // Memo
    await dialog.getByLabel("メモ").fill("朝早めに行くのがおすすめ");

    await dialog.getByRole("button", { name: "予定を追加" }).click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();
    await expect(page.getByText("清水寺")).toBeVisible();
  });

  test("adds a transport schedule with transport-specific fields", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Transport Schedule Test",
      destination: "Osaka",
    });

    await page.getByRole("button", { name: "予定を追加" }).click();
    const dialog = page.locator("[role=dialog]");

    await dialog.getByLabel("名前").fill("新幹線");

    // Switch category to transport (first combobox in dialog)
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "移動" }).click();

    // Transport-specific fields
    await dialog.getByLabel("出発地").fill("東京駅");
    await dialog.getByLabel("到着地").fill("新大阪駅");

    // Transport method is the second combobox (after category)
    await dialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "電車" }).click();

    await dialog.getByRole("button", { name: "予定を追加" }).click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();
    // Transport schedules display as route: "departure → arrival"
    await expect(page.getByText("東京駅 → 新大阪駅")).toBeVisible();
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

  test("unassigns a schedule back to candidates", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Unassign Test",
      destination: "Kobe",
    });

    // Add a schedule
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("北野異人館");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    // Unassign via menu
    await page.getByRole("button", { name: "北野異人館のメニュー" }).click();
    await page.getByRole("menuitem", { name: "候補に戻す" }).click();

    await expect(page.getByText("候補に戻しました")).toBeVisible();
  });

  test("sort button is disabled when already sorted", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Sort Test",
      destination: "Fukuoka",
    });

    // Add two schedules without time
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("太宰府天満宮");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("太宰府天満宮")).toBeVisible();

    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("博多ラーメン");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("博多ラーメン")).toBeVisible();

    // Sort button should be disabled when schedules have no times
    await expect(page.getByRole("button", { name: "時刻順" })).toBeDisabled();
  });

  test("switches between day tabs", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Day Tab Test",
      destination: "Nikko",
    });

    // Trip has 3 days (10th-12th), so there should be day tabs
    const tab1 = page.getByRole("tab", { name: /1日目/ });
    const tab2 = page.getByRole("tab", { name: /2日目/ });
    const tab3 = page.getByRole("tab", { name: /3日目/ });

    await expect(tab1).toBeVisible();
    await expect(tab2).toBeVisible();
    await expect(tab3).toBeVisible();

    // Add a schedule on day 1
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("東照宮");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    // Switch to day 2
    await tab2.click();
    // The schedule from day 1 should not appear in day 2's timeline
    await expect(page.getByText("まだ予定がありません")).toBeVisible();

    // Switch back to day 1
    await tab1.click();
    await expect(page.getByText("東照宮")).toBeVisible();
  });
});
