import { BASE_URL, createTripViaUI, expect, signupUser, test } from "./fixtures/auth";

const PASSWORD = "TestPassword123!";

function shortId() {
  return Date.now().toString(36).slice(-6);
}

async function deleteAccount(page: import("@playwright/test").Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "アカウントを削除" }).click();
  await page.getByLabel("パスワードを入力して確認").fill(PASSWORD);
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
}

async function loginUser(
  page: import("@playwright/test").Page,
  username: string,
) {
  await page.goto("/auth/login");
  await page.getByLabel("ユーザー名").fill(username);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
}

test.describe("Delete Account", () => {
  test("cannot log in after account deletion", async ({
    authenticatedPage: page,
    userCredentials,
  }) => {
    await deleteAccount(page);

    // Re-login with same credentials should fail
    await loginUser(page, userCredentials.username);
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("friend list shows no error after friend deletes account", async ({
    authenticatedPage: pageA,
    browser,
  }) => {
    // Create User B
    const contextB = await browser.newContext({ baseURL: BASE_URL });
    const pageB = await contextB.newPage();
    const userB = `delf_${shortId()}`;
    await signupUser(pageB, { username: userB, name: "User B" });

    // Get User A's ID
    await pageA.goto("/settings");
    const userAId = await pageA.locator("code").first().textContent();
    expect(userAId).toBeTruthy();

    // User B sends friend request to User A
    await pageB.goto("/friends");
    await pageB.getByLabel("ユーザーID").fill(userAId!);
    await pageB.getByRole("button", { name: "申請" }).click();
    await expect(pageB.getByText("フレンド申請を送信しました")).toBeVisible();

    // User A accepts
    await pageA.goto("/friends");
    await expect(pageA.getByText("User B")).toBeVisible();
    await pageA.getByRole("button", { name: "承認" }).click();
    await expect(pageA.getByText("フレンド申請を承認しました")).toBeVisible();

    // Verify friendship is established
    await expect(pageA.getByText("フレンド一覧")).toBeVisible();
    await expect(pageA.getByText("User B")).toBeVisible();

    // User B deletes account
    await deleteAccount(pageB);
    await contextB.close();

    // User A reloads friend list - no error, User B is gone
    await pageA.goto("/friends");
    await expect(pageA.getByText("フレンド一覧")).toBeVisible();
    await expect(pageA.getByText("User B")).not.toBeVisible();
  });

  test("shared trips are not affected when a member deletes account", async ({
    authenticatedPage: pageA,
    browser,
  }) => {
    // Create User B
    const contextB = await browser.newContext({ baseURL: BASE_URL });
    const pageB = await contextB.newPage();
    const userB = `delm_${shortId()}`;
    await signupUser(pageB, { username: userB, name: "User B" });

    // Get User B's ID
    await pageB.goto("/settings");
    const userBId = await pageB.locator("code").first().textContent();
    expect(userBId).toBeTruthy();

    // Get User A's ID
    await pageA.goto("/settings");
    const userAId = await pageA.locator("code").first().textContent();
    expect(userAId).toBeTruthy();

    // User A creates a trip and adds User B
    await pageA.goto("/home");
    const tripAUrl = await createTripViaUI(pageA, {
      title: "A's Trip",
      destination: "Tokyo",
    });
    await pageA.getByRole("button", { name: "メンバー" }).click();
    await pageA.getByRole("tab", { name: "IDで追加" }).click();
    await pageA.locator("#member-user-id").fill(userBId!);
    await pageA.getByRole("button", { name: "追加" }).click();
    await expect(pageA.getByText("メンバーを追加しました")).toBeVisible();
    // Close member dialog
    await pageA.keyboard.press("Escape");

    // User B creates a trip and adds User A
    await pageB.goto("/home");
    await createTripViaUI(pageB, {
      title: "B's Trip",
      destination: "Osaka",
    });
    await pageB.getByRole("button", { name: "メンバー" }).click();
    await pageB.getByRole("tab", { name: "IDで追加" }).click();
    await pageB.locator("#member-user-id").fill(userAId!);
    await pageB.getByRole("button", { name: "追加" }).click();
    await expect(pageB.getByText("メンバーを追加しました")).toBeVisible();

    // User A deletes account
    await deleteAccount(pageA);

    // User B's home: A's trip is gone (CASCADE), B's trip remains
    await pageB.goto("/home");
    await expect(pageB.getByText("B's Trip")).toBeVisible();
    await expect(pageB.getByText("A's Trip")).not.toBeVisible();

    // User B's trip member list: User A is gone
    await pageB.getByText("B's Trip").click();
    await expect(pageB).toHaveURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });
    await pageB.getByRole("button", { name: "メンバー" }).click();
    await expect(pageB.getByText("E2E User")).not.toBeVisible();

    await contextB.close();
  });
});
