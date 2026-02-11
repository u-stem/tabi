import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Shared Trip", () => {
  test("generates share link and views shared trip", async ({
    authenticatedPage: page,
    browser,
  }) => {
    await createTripViaUI(page, {
      title: "Shared Trip Test",
      destination: "Nagoya",
    });

    // Grant clipboard permission for headless browser
    await page.context().grantPermissions(["clipboard-write", "clipboard-read"]);

    // Generate share link and capture the token from API response
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/trips/") && res.url().endsWith("/share") && res.ok(),
    );
    await page.getByRole("button", { name: "共有リンク" }).click();
    const response = await responsePromise;
    const body = (await response.json()) as { shareToken: string };
    const shareToken = body.shareToken;

    await expect(page.getByText("共有リンクをコピーしました")).toBeVisible();

    // Open shared link in a new unauthenticated context
    const context = await browser.newContext();
    const sharedPage = await context.newPage();
    await sharedPage.goto(`/shared/${shareToken}`);

    await expect(sharedPage.getByText("Shared Trip Test")).toBeVisible({
      timeout: 10000,
    });
    await context.close();
  });

  test("shows error for invalid share token", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("http://localhost:3000/shared/invalidtoken123");

    await expect(
      page.getByText("このリンクは無効か、有効期限が切れています"),
    ).toBeVisible({ timeout: 10000 });
    await context.close();
  });
});
