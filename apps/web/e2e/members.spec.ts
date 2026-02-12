import { expect, test } from "./fixtures/auth";
import { createTripViaUI } from "./fixtures/auth";

test.describe("Members", () => {
  test("adds a member and changes role", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Create a second user in a separate context
    const memberUsername = `member${Date.now()}`;
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await memberPage.goto("http://localhost:3000/auth/signup");
    await memberPage.getByLabel("ユーザー名").fill(memberUsername);
    await memberPage.getByLabel("表示名").fill("Member User");
    await memberPage.getByLabel("パスワード", { exact: true }).fill("TestPassword123!");
    await memberPage.getByLabel("パスワード（確認）").fill("TestPassword123!");
    await memberPage.getByRole("button", { name: "新規登録" }).click();
    await expect(memberPage).toHaveURL(/\/home/, { timeout: 10000 });

    // Get member's user ID from settings page
    await memberPage.goto("http://localhost:3000/settings");
    const memberId = await memberPage.locator("code").first().textContent();
    await memberContext.close();

    // Owner creates a trip
    await createTripViaUI(page, {
      title: "Member Test Trip",
      destination: "Sendai",
    });

    // Open member dialog and add the member by user ID
    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByPlaceholder("ユーザーID").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();

    // Verify member appears in the list
    await expect(page.getByText("Member User")).toBeVisible();

    // Change role to viewer
    const memberRow = page.getByText("Member User").locator("../..");
    await memberRow.getByRole("combobox").click();
    await page.getByRole("option", { name: "閲覧者" }).click();
    await expect(page.getByText("ロールを変更しました")).toBeVisible();
  });

  test("removes a member", async ({ authenticatedPage: page, browser }) => {
    // Create a second user
    const memberUsername = `remove${Date.now()}`;
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await memberPage.goto("http://localhost:3000/auth/signup");
    await memberPage.getByLabel("ユーザー名").fill(memberUsername);
    await memberPage.getByLabel("表示名").fill("Remove User");
    await memberPage.getByLabel("パスワード", { exact: true }).fill("TestPassword123!");
    await memberPage.getByLabel("パスワード（確認）").fill("TestPassword123!");
    await memberPage.getByRole("button", { name: "新規登録" }).click();
    await expect(memberPage).toHaveURL(/\/home/, { timeout: 10000 });

    // Get member's user ID from settings page
    await memberPage.goto("http://localhost:3000/settings");
    const memberId = await memberPage.locator("code").first().textContent();
    await memberContext.close();

    // Owner creates a trip and adds member
    await createTripViaUI(page, {
      title: "Remove Member Test",
      destination: "Sapporo",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByPlaceholder("ユーザーID").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();
    await expect(page.getByText("Remove User")).toBeVisible();

    // Remove the member
    await page.getByRole("button", { name: "Remove Userを削除" }).click();
    await expect(page.getByText("メンバーを削除しました")).toBeVisible();
    await expect(page.getByText("Remove User")).not.toBeVisible();
  });
});
