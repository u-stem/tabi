import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Activity Log", () => {
  test("shows activity log after trip creation", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Activity Log Test",
      destination: "Kyoto",
    });

    await page.getByRole("tab", { name: "履歴" }).click();

    // Trip creation generates a log entry like "旅行「Activity Log Test」を作成"
    await expect(page.getByText(/「Activity Log Test」/)).toBeVisible({ timeout: 10000 });
  });

  test("activity log records schedule creation", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Activity Record Test",
      destination: "Osaka",
    });

    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("道頓堀");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    await page.getByRole("tab", { name: "履歴" }).click();

    // Log entry: "予定「道頓堀」を追加" — check for the bracketed schedule name
    await expect(page.getByText(/「道頓堀」/)).toBeVisible({ timeout: 10000 });
  });

  test("activity tab is accessible and selectable", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Activity Tab Test",
      destination: "Nara",
    });

    await page.getByRole("tab", { name: "履歴" }).click();

    await expect(page.getByRole("tab", { name: "履歴" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
