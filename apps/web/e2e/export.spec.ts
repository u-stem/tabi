import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Export", () => {
  test("shows export page with trip title pre-filled in filename", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Filename Test",
      destination: "Kyoto",
    });
    await page.goto(`${tripUrl}/export`);

    // buildDefaultFileName appends today's date; title should be part of the value
    await expect(page.locator("#export-filename")).toHaveValue(/Export Filename Test/, {
      timeout: 10000,
    });
  });

  test("export button is disabled until a field is selected", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Disabled Test",
      destination: "Osaka",
    });
    await page.goto(`${tripUrl}/export`);
    await expect(page.locator("#export-filename")).toHaveValue(/.+/, { timeout: 10000 });

    // No fields selected → export button disabled
    await expect(page.getByRole("button", { name: "エクスポート" })).toBeDisabled();

    // Select all fields → export button enabled
    await page.getByRole("button", { name: "全選択" }).click();
    await expect(page.getByRole("button", { name: "エクスポート" })).toBeEnabled();
  });

  test("全選択 selects all fields and 選択解除 clears them", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Select Test",
      destination: "Nara",
    });
    await page.goto(`${tripUrl}/export`);
    await expect(page.locator("#export-filename")).toHaveValue(/.+/, { timeout: 10000 });

    // 選択解除 button is disabled when nothing is selected
    await expect(page.getByRole("button", { name: "選択解除" })).toBeDisabled();

    // Click 全選択
    await page.getByRole("button", { name: "全選択" }).click();

    // 選択解除 becomes enabled
    await expect(page.getByRole("button", { name: "選択解除" })).toBeEnabled();

    // Click 選択解除 → clears all selections
    await page.getByRole("button", { name: "選択解除" }).click();
    await expect(page.getByRole("button", { name: "選択解除" })).toBeDisabled();
  });

  test("switches format between Excel and CSV", async ({ authenticatedPage: page }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Format Test",
      destination: "Fukuoka",
    });
    await page.goto(`${tripUrl}/export`);
    await expect(page.locator("#export-filename")).toHaveValue(/.+/, { timeout: 10000 });

    // Default format is Excel
    const formatSelect = page.getByLabel("フォーマット");
    await expect(formatSelect).toHaveText(/Excel/);

    // Switch to CSV
    await formatSelect.click();
    await page.getByRole("option", { name: "CSV (.csv)" }).click();
    await expect(formatSelect).toHaveText(/CSV/);

    // CSV options section appears
    await expect(page.getByText("CSV 設定")).toBeVisible();

    // Switch back to Excel
    await formatSelect.click();
    await page.getByRole("option", { name: "Excel (.xlsx)" }).click();
    await expect(formatSelect).toHaveText(/Excel/);
    await expect(page.getByText("CSV 設定")).not.toBeVisible();
  });

  test("exports file and shows success toast when export button is clicked", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Download Test",
      destination: "Sapporo",
    });
    await page.goto(`${tripUrl}/export`);
    await expect(page.locator("#export-filename")).toHaveValue(/.+/, { timeout: 10000 });

    // Switch to CSV for simpler export path
    const formatSelect = page.getByLabel("フォーマット");
    await formatSelect.click();
    await page.getByRole("option", { name: "CSV (.csv)" }).click();

    // Select all fields
    await page.getByRole("button", { name: "全選択" }).click();

    await page.getByRole("button", { name: "エクスポート" }).click();
    await expect(page.getByText("エクスポートしました")).toBeVisible({ timeout: 10000 });
  });
});
