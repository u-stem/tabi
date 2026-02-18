import { BASE_URL, expect, signupUser, test } from "./fixtures/auth";

test.describe("Friends", () => {
  test("sends a friend request, accepts it, and removes friend", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Create user B in a separate context
    const contextB = await browser.newContext({ baseURL: BASE_URL });
    const pageB = await contextB.newPage();
    await signupUser(pageB, {
      username: `friend_b_${Date.now()}`,
      name: "Friend B",
    });

    // Get user B's ID
    await pageB.goto("/settings");
    const userBId = await pageB.locator("code").first().textContent();
    expect(userBId).toBeTruthy();

    // User A sends friend request to user B
    await page.goto("/friends");
    await page.getByLabel("ユーザーID").fill(userBId!);
    await page.getByRole("button", { name: "申請" }).click();
    await expect(page.getByText("フレンド申請を送信しました")).toBeVisible();

    // User B sees the request and accepts it
    await pageB.goto("/friends");
    await expect(pageB.getByText("フレンドリクエスト")).toBeVisible();
    await expect(pageB.getByText("E2E User")).toBeVisible();
    await pageB.getByRole("button", { name: "承認" }).click();
    await expect(pageB.getByText("フレンド申請を承認しました")).toBeVisible();

    // User B sees user A in friend list
    await expect(pageB.getByText("フレンド一覧")).toBeVisible();
    await expect(pageB.getByText("E2E User")).toBeVisible();

    // User A sees user B in friend list after reload
    await page.goto("/friends");
    await expect(page.getByText("Friend B")).toBeVisible();

    // User A removes user B
    await page.getByRole("button", { name: "解除" }).click();
    await page.getByRole("button", { name: "解除する" }).click();
    await expect(page.getByText("フレンドを解除しました")).toBeVisible();
    await expect(page.getByText("フレンドがいません")).toBeVisible();

    await contextB.close();
  });

  test("rejects a friend request", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Create user C
    const contextC = await browser.newContext({ baseURL: BASE_URL });
    const pageC = await contextC.newPage();
    await signupUser(pageC, {
      username: `friend_c_${Date.now()}`,
      name: "Friend C",
    });

    // Get user A's ID
    await page.goto("/settings");
    const userAId = await page.locator("code").first().textContent();
    expect(userAId).toBeTruthy();

    // User C sends request to user A
    await pageC.goto("/friends");
    await pageC.getByLabel("ユーザーID").fill(userAId!);
    await pageC.getByRole("button", { name: "申請" }).click();
    await expect(pageC.getByText("フレンド申請を送信しました")).toBeVisible();

    // User A rejects the request
    await page.goto("/friends");
    await expect(page.getByText("フレンドリクエスト")).toBeVisible();
    await expect(page.getByText("Friend C")).toBeVisible();
    await page.getByRole("button", { name: "拒否" }).click();
    await expect(page.getByText("フレンド申請を拒否しました")).toBeVisible();

    // Request section disappears
    await expect(page.getByText("フレンドリクエスト")).not.toBeVisible();

    await contextC.close();
  });
});
