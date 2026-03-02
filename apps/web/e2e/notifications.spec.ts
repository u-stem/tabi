import { BASE_URL, createTripViaUI, expect, signupUser, test } from "./fixtures/auth";

test.describe("Notifications", () => {
  test("shows unread badge when member is added to trip", async ({
    authenticatedPage: page,
    browser,
  }) => {
    const memberContext = await browser.newContext({ baseURL: BASE_URL });
    const memberPage = await memberContext.newPage();
    await signupUser(memberPage, {
      username: `notif${Date.now()}`,
      name: "Notif User",
    });

    await memberPage.goto("/friends");
    const memberId = await memberPage.locator('[data-testid="user-id"]').textContent();
    expect(memberId).toBeTruthy();

    await createTripViaUI(page, {
      title: "Notification Trip",
      destination: "Sendai",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "IDで追加" }).click();
    await page.locator("#member-user-id").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();

    // Member reloads and should see notification badge
    await memberPage.reload();
    const badge = memberPage.locator("button:has(.lucide-bell) span").first();
    await expect(badge).toBeVisible({ timeout: 15000 });

    await memberContext.close();
  });

  test("marks all notifications as read", async ({
    authenticatedPage: page,
    browser,
  }) => {
    const memberContext = await browser.newContext({ baseURL: BASE_URL });
    const memberPage = await memberContext.newPage();
    await signupUser(memberPage, {
      username: `notif2${Date.now()}`,
      name: "Notif User 2",
    });

    await memberPage.goto("/friends");
    const memberId = await memberPage.locator('[data-testid="user-id"]').textContent();
    expect(memberId).toBeTruthy();

    await createTripViaUI(page, {
      title: "Mark Read Trip",
      destination: "Kanazawa",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "IDで追加" }).click();
    await page.locator("#member-user-id").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();

    // Member opens notification dropdown and marks all as read
    await memberPage.reload();
    await memberPage.locator("button:has(.lucide-bell)").click();
    await expect(memberPage.getByText("通知")).toBeVisible();

    await memberPage.getByText("すべて既読").click();

    // Badge should disappear after marking all read
    await expect(memberPage.locator("button:has(.lucide-bell) span")).not.toBeVisible({
      timeout: 5000,
    });

    await memberContext.close();
  });

  test("can toggle in-app notification preferences", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: "通知" }).click();

    // Each category row has an in-app switch with aria-label "{category} アプリ内通知"
    const memberToggle = page.getByRole("switch", { name: "メンバー アプリ内通知" });
    await expect(memberToggle).toBeVisible();

    const initialState = await memberToggle.isChecked();

    await memberToggle.click();
    // Switch state reflects an API mutation, so wait for the update to propagate.
    await expect(memberToggle).toBeChecked({ checked: !initialState });

    // Toggle back to original state
    await memberToggle.click();
    await expect(memberToggle).toBeChecked({ checked: initialState });
  });
});
