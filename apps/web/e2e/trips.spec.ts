import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Trip Management", () => {
  test("creates a new trip and sees it on detail page", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "E2E Trip",
      destination: "Osaka",
    });

    expect(tripUrl).toMatch(/\/trips\/[a-f0-9-]+/);
    await expect(page.getByText("E2E Trip")).toBeVisible();
  });
});
