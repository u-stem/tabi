import { BASE_URL, createTripViaUI, expect, signupUser, test } from "./fixtures/auth";

test.describe("Members", () => {
  test("adds a member and changes role", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Create a second user in a separate context
    const memberContext = await browser.newContext({ baseURL: BASE_URL });
    const memberPage = await memberContext.newPage();
    await signupUser(memberPage, {
      username: `member${Date.now()}`,
      name: "Member User",
    });

    // Get member's user ID from settings page
    await memberPage.goto("/settings");
    const memberId = await memberPage.locator("code").first().textContent();
    expect(memberId).toBeTruthy();
    await memberContext.close();

    // Owner creates a trip
    await createTripViaUI(page, {
      title: "Member Test Trip",
      destination: "Sendai",
    });

    // Open member dialog and add the member by user ID
    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "ユーザーIDで追加" }).click();
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
    const memberContext = await browser.newContext({ baseURL: BASE_URL });
    const memberPage = await memberContext.newPage();
    await signupUser(memberPage, {
      username: `remove${Date.now()}`,
      name: "Remove User",
    });

    // Get member's user ID from settings page
    await memberPage.goto("/settings");
    const memberId = await memberPage.locator("code").first().textContent();
    expect(memberId).toBeTruthy();
    await memberContext.close();

    // Owner creates a trip and adds member
    await createTripViaUI(page, {
      title: "Remove Member Test",
      destination: "Sapporo",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "ユーザーIDで追加" }).click();
    await page.getByPlaceholder("ユーザーID").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();
    await expect(page.getByText("Remove User")).toBeVisible();

    // Remove the member - click delete icon, then confirm
    await page.getByRole("button", { name: "Remove Userを削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("メンバーを削除しました")).toBeVisible();
    await expect(page.getByText("Remove User")).not.toBeVisible();
  });
});
