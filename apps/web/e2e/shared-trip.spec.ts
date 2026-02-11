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

  test("regenerates share link", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Regenerate Link Test",
      destination: "Shizuoka",
    });

    await page.context().grantPermissions(["clipboard-write", "clipboard-read"]);

    // Generate initial share link
    const firstResponse = page.waitForResponse(
      (res) => res.url().includes("/api/trips/") && res.url().endsWith("/share") && res.ok(),
    );
    await page.getByRole("button", { name: "共有リンク" }).click();
    await firstResponse;
    await expect(page.getByText("共有リンクをコピーしました")).toBeVisible();

    // Regenerate share link
    const secondResponse = page.waitForResponse(
      (res) => res.url().includes("/api/trips/") && res.url().endsWith("/share") && res.ok(),
    );
    await page.getByRole("button", { name: "共有リンクを再生成" }).click();
    await secondResponse;
    await expect(page.getByText("共有リンクを再生成してコピーしました")).toBeVisible();
  });

  test("shows shared trip on shared-trips page", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Owner creates a trip and adds another user as member
    const memberEmail = `e2e-shared-list-${Date.now()}@test.com`;

    // Create the member user
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await memberPage.goto("http://localhost:3000/auth/signup");
    await memberPage.getByLabel("名前").fill("Shared List User");
    await memberPage.getByLabel("メールアドレス").fill(memberEmail);
    await memberPage.getByLabel("パスワード").fill("TestPassword123!");
    await memberPage.getByRole("button", { name: "アカウントを作成" }).click();
    await expect(memberPage).toHaveURL(/\/home/, { timeout: 10000 });

    // Owner creates a trip
    await createTripViaUI(page, {
      title: "Shared List Trip",
      destination: "Kanazawa",
    });

    // Add member
    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByPlaceholder("メールアドレス").fill(memberEmail);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();

    // Member navigates to shared-trips page
    await memberPage.getByRole("link", { name: "共有" }).click();
    await expect(memberPage).toHaveURL(/\/shared-trips/, { timeout: 10000 });
    await expect(memberPage.getByText("Shared List Trip")).toBeVisible({
      timeout: 10000,
    });

    await memberContext.close();
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
