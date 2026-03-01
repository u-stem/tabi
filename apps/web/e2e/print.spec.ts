import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Print", () => {
  test("shows trip title on print page", async ({ authenticatedPage: page }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Print Title Test",
      destination: "Kyoto",
    });
    await page.goto(`${tripUrl}/print`);

    await expect(page.getByRole("heading", { name: "Print Title Test" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows trip destination and date range on print page", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Print Info Test",
      destination: "Osaka",
    });
    await page.goto(`${tripUrl}/print`);

    await expect(page.getByRole("heading", { name: "Print Info Test" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Osaka")).toBeVisible();
    // Date range is shown when start/end dates are set (trip created with 10th–12th)
    await expect(page.getByText(/日間/)).toBeVisible();
  });

  test("shows day sections for confirmed trip", async ({ authenticatedPage: page }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Print Days Test",
      destination: "Nara",
    });
    await page.goto(`${tripUrl}/print`);

    await expect(page.getByRole("heading", { name: "Print Days Test" })).toBeVisible({
      timeout: 10000,
    });
    // Trip has dates → day sections appear (e.g. "1日目")
    await expect(page.getByRole("heading", { name: /1日目/ })).toBeVisible({ timeout: 5000 });
  });

  test("print button is present on print page", async ({ authenticatedPage: page }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Print Button Test",
      destination: "Fukuoka",
    });
    await page.goto(`${tripUrl}/print`);

    await expect(page.getByRole("heading", { name: "Print Button Test" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole("button", { name: "印刷 / PDF保存" })).toBeVisible();
  });
});
