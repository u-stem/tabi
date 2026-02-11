import { expect, test } from "./fixtures/auth";
import { createTripViaUI } from "./fixtures/auth";

test.describe("Members", () => {
  test("adds a member and changes role", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Create a second user in a separate context
    const memberEmail = `e2e-member-${Date.now()}@test.com`;
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await memberPage.goto("http://localhost:3000/auth/signup");
    await memberPage.getByLabel("名前").fill("Member User");
    await memberPage.getByLabel("メールアドレス").fill(memberEmail);
    await memberPage.getByLabel("パスワード").fill("TestPassword123!");
    await memberPage.getByRole("button", { name: "アカウントを作成" }).click();
    await expect(memberPage).toHaveURL(/\/home/, { timeout: 10000 });
    await memberContext.close();

    // Owner creates a trip
    await createTripViaUI(page, {
      title: "Member Test Trip",
      destination: "Sendai",
    });

    // Open member dialog and add the member
    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByPlaceholder("メールアドレス").fill(memberEmail);
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
    const memberEmail = `e2e-remove-${Date.now()}@test.com`;
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await memberPage.goto("http://localhost:3000/auth/signup");
    await memberPage.getByLabel("名前").fill("Remove User");
    await memberPage.getByLabel("メールアドレス").fill(memberEmail);
    await memberPage.getByLabel("パスワード").fill("TestPassword123!");
    await memberPage.getByRole("button", { name: "アカウントを作成" }).click();
    await expect(memberPage).toHaveURL(/\/home/, { timeout: 10000 });
    await memberContext.close();

    // Owner creates a trip and adds member
    await createTripViaUI(page, {
      title: "Remove Member Test",
      destination: "Sapporo",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByPlaceholder("メールアドレス").fill(memberEmail);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();
    await expect(page.getByText("Remove User")).toBeVisible();

    // Remove the member
    await page.getByRole("button", { name: "Remove Userを削除" }).click();
    await expect(page.getByText("メンバーを削除しました")).toBeVisible();
    await expect(page.getByText("Remove User")).not.toBeVisible();
  });
});
