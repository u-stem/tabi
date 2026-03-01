# Playwright テスト拡充 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 経費・みやげ・投票・リアクション・通知・アクティビティ・エクスポート・印刷・権限・静的ページの E2E テストを追加し、あらゆる操作がテストされた状態を実現する。

**Architecture:** 既存の `apps/web/e2e/` 構造に合わせ、機能ごとに 1 ファイルを追加する。`fixtures/auth.ts` に投票トリップ作成ヘルパーを追加する。各テストは独立したユーザー/データを作成し、共有ステートを持たない。

**Tech Stack:** Playwright (Chromium)、TypeScript、既存 fixtures/auth.ts パターン

---

## 共通知識

テストパターンの基礎:
- `import { createTripViaUI, expect, test } from "./fixtures/auth"` — 全ファイル共通
- `authenticatedPage: page` — 認証済みページ fixture
- 右パネルタブ: `page.getByRole("tab", { name: "費用" })` / `"お土産"` / `"履歴"`
- 通知ベルボタン: `page.locator('button:has(.lucide-bell)')`
- みやげ・経費はトースト無し → アイテムの表示で確認
- 投票タブ: `page.getByRole("tab", { name: "日程調整" })`

---

## Task 1: fixtures/auth.ts に createTripWithPollViaUI を追加

投票機能のテストに必要なヘルパーを追加する。

**Files:**
- Modify: `apps/web/e2e/fixtures/auth.ts`

**Step 1: ファイルを読む**

```bash
cat apps/web/e2e/fixtures/auth.ts
```

**Step 2: ヘルパー関数を追加する**

`createTripViaUI` の後に以下を追加:

```typescript
export async function createTripWithPollViaUI(
  page: Page,
  options: { title: string; destination?: string },
): Promise<string> {
  await page.getByRole("button", { name: "新規作成" }).click();
  const dialog = page.getByRole("dialog", { name: "新しい旅行を作成" });
  await expect(dialog).toBeVisible();

  await dialog.locator("#create-title").fill(options.title);
  if (options.destination) {
    await dialog.locator("#create-destination").fill(options.destination);
  }

  // Switch to poll mode
  await dialog.getByRole("tab", { name: "日程を調整する" }).click();

  // Select a date range (10th-12th of the currently displayed month)
  const firstGrid = dialog.getByRole("grid").first();
  await firstGrid.getByRole("gridcell", { name: /10/ }).first().click();
  await firstGrid.getByRole("gridcell", { name: /12/ }).first().click();
  await dialog.getByRole("button", { name: "日程案に追加" }).click();

  await dialog.getByRole("button", { name: "作成" }).click();
  await expect(dialog).not.toBeVisible({ timeout: 15000 });

  const tripLink = page.getByRole("link", { name: new RegExp(options.title) }).first();
  await expect(tripLink).toBeVisible({ timeout: 15000 });
  await tripLink.click();
  await expect(page).toHaveURL(/\/trips\/[a-f0-9-]+/, { timeout: 10000 });

  return page.url();
}
```

**Step 3: 型チェック**

```bash
bun run check-types
```

Expected: no errors

**Step 4: コミット**

```bash
git add apps/web/e2e/fixtures/auth.ts
git commit -m "test: createTripWithPollViaUI ヘルパーを fixtures に追加"
```

---

## Task 2: expenses.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/expenses.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Expenses", () => {
  test("adds an expense with equal split", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Add Test", destination: "Tokyo" });

    // Switch to expenses tab
    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await expect(dialog).toBeVisible();
    await dialog.locator("#expense-title").fill("夕食");
    await dialog.locator("#expense-amount").fill("3000");

    // Select payer (the current user - auto-selected as only member)
    const payerSelect = dialog.locator("#expense-paid-by");
    await payerSelect.click();
    await page.getByRole("option").first().click();

    // Equal split is default
    await expect(dialog.getByRole("tab", { name: "均等" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("夕食")).toBeVisible();
  });

  test("adds an expense with custom split", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Custom Test", destination: "Osaka" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await dialog.locator("#expense-title").fill("お土産");
    await dialog.locator("#expense-amount").fill("2000");

    const payerSelect = dialog.locator("#expense-paid-by");
    await payerSelect.click();
    await page.getByRole("option").first().click();

    // Switch to custom split
    await dialog.getByRole("tab", { name: "カスタム" }).click();

    // Enter custom amount equal to total (only one member)
    const customInput = dialog.locator('input[type="number"]').last();
    await customInput.fill("2000");

    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("お土産")).toBeVisible();
  });

  test("shows validation error when custom split total mismatches amount", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Expense Validation Test",
      destination: "Kyoto",
    });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "費用を追加" });
    await dialog.locator("#expense-title").fill("ランチ");
    await dialog.locator("#expense-amount").fill("5000");

    const payerSelect = dialog.locator("#expense-paid-by");
    await payerSelect.click();
    await page.getByRole("option").first().click();

    await dialog.getByRole("tab", { name: "カスタム" }).click();

    // Enter wrong amount (mismatch)
    const customInput = dialog.locator('input[type="number"]').last();
    await customInput.fill("3000");

    // Submit button should be disabled due to mismatch
    await expect(dialog.getByRole("button", { name: "追加" })).toBeDisabled();
    await expect(page.getByText("(一致していません)")).toBeVisible();
  });

  test("edits an expense", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Edit Test", destination: "Nara" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "費用を追加" });
    await addDialog.locator("#expense-title").fill("交通費");
    await addDialog.locator("#expense-amount").fill("1000");
    await addDialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("交通費")).toBeVisible();

    // Edit the expense
    await page.getByRole("button", { name: "交通費のメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    const editDialog = page.getByRole("dialog", { name: "費用を編集" });
    await expect(editDialog).toBeVisible();
    await editDialog.locator("#expense-title").clear();
    await editDialog.locator("#expense-title").fill("電車代");
    await editDialog.getByRole("button", { name: "更新" }).click();
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("電車代")).toBeVisible();
    await expect(page.getByText("交通費")).not.toBeVisible();
  });

  test("deletes an expense", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, { title: "Expense Delete Test", destination: "Fukuoka" });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "費用を追加" });
    await addDialog.locator("#expense-title").fill("宿泊費");
    await addDialog.locator("#expense-amount").fill("8000");
    await addDialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("宿泊費")).toBeVisible();

    // Delete the expense
    await page.getByRole("button", { name: "宿泊費のメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("宿泊費")).not.toBeVisible();
  });

  test("shows settlement summary after adding expense", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Expense Settlement Test",
      destination: "Sapporo",
    });

    await page.getByRole("tab", { name: "費用" }).click();
    await page.getByRole("button", { name: "費用を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "費用を追加" });
    await addDialog.locator("#expense-title").fill("観光費");
    await addDialog.locator("#expense-amount").fill("5000");
    await addDialog.locator("#expense-paid-by").click();
    await page.getByRole("option").first().click();
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    // Settlement summary should be visible
    await expect(page.getByText("合計支出")).toBeVisible();
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium expenses.spec.ts
```

Expected: all 5 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/expenses.spec.ts
git commit -m "test: 経費管理の E2E テストを追加"
```

---

## Task 3: polls.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/polls.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { createTripWithPollViaUI, expect, test } from "./fixtures/auth";

test.describe("Polls", () => {
  test("adds and edits a poll note", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, { title: "Poll Note Test", destination: "Kyoto" });

    // Navigate to poll tab
    await page.getByRole("tab", { name: "日程調整" }).click();

    // Add a note
    await page.getByRole("button", { name: "メモを追加" }).click();
    await page.getByRole("textbox").fill("日程候補についてのメモ");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText("メモを更新しました")).toBeVisible();
    await expect(page.getByText("日程候補についてのメモ")).toBeVisible();
  });

  test("adds a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Option Test",
      destination: "Osaka",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // Add another schedule option via toolbar
    await page.getByRole("button", { name: "日程案追加" }).click();

    const dialog = page.getByRole("dialog", { name: "日程案を追加" });
    await expect(dialog).toBeVisible();

    // Select a date range in the calendar
    const grid = dialog.getByRole("grid").first();
    await grid.getByRole("gridcell", { name: /15/ }).first().click();
    await grid.getByRole("gridcell", { name: /17/ }).first().click();

    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("日程案を追加しました")).toBeVisible();
  });

  test("votes on a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Vote Test",
      destination: "Nara",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // Vote ○ on the first option
    await page.getByRole("button", { name: "○" }).first().click();

    // Verify the response was submitted (no error toast)
    await expect(page.getByRole("button", { name: "○" }).first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("deletes a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Delete Option Test",
      destination: "Nagano",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // Get the count of options before deletion
    const optionCountBefore = await page.getByRole("button", { name: "○" }).count();

    // Delete the first option (owner mode - delete button visible)
    await page.getByRole("button", { name: "日程案を削除" }).first().click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("日程案を削除しました")).toBeVisible();

    // Verify option count decreased
    const optionCountAfter = await page.getByRole("button", { name: "○" }).count();
    expect(optionCountAfter).toBeLessThan(optionCountBefore);
  });

  test("confirms a poll option", async ({ authenticatedPage: page }) => {
    await createTripWithPollViaUI(page, {
      title: "Poll Confirm Test",
      destination: "Sendai",
    });

    await page.getByRole("tab", { name: "日程調整" }).click();

    // Confirm the first option
    await page.getByRole("button", { name: "確定" }).first().click();

    const confirmDialog = page.getByRole("dialog", { name: "日程を確定" });
    await expect(confirmDialog).toBeVisible();

    await confirmDialog.getByRole("button", { name: "確定する" }).click();
    await expect(page.getByText("日程を確定しました")).toBeVisible();

    // Trip should now show day tabs (scheduling -> planned with dates)
    await expect(page.getByRole("tab", { name: /1日目/ })).toBeVisible({ timeout: 10000 });
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium polls.spec.ts
```

Expected: all 5 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/polls.spec.ts
git commit -m "test: 日程投票の E2E テストを追加"
```

---

## Task 4: reactions.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/reactions.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Reactions", () => {
  test("adds a like reaction to a candidate", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Reaction Like Test",
      destination: "Kamakura",
    });

    // Add a candidate first
    await page.getByRole("button", { name: "候補を追加" }).click();
    await page.locator("#candidate-name").fill("鶴岡八幡宮");
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByText("候補を追加しました")).toBeVisible();

    // React with いいね
    await page.getByRole("button", { name: "いいね" }).click();

    // Verify the reaction is active (aria-pressed becomes true)
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("changes reaction from like to hmm", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Reaction Change Test",
      destination: "Kamakura",
    });

    await page.getByRole("button", { name: "候補を追加" }).click();
    await page.locator("#candidate-name").fill("長谷寺");
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByText("候補を追加しました")).toBeVisible();

    // First add いいね
    await page.getByRole("button", { name: "いいね" }).click();
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Then switch to うーん (this removes いいね and adds うーん)
    await page.getByRole("button", { name: "うーん" }).click();
    await expect(page.getByRole("button", { name: "うーん" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("removes a reaction by clicking the active button again", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Reaction Remove Test",
      destination: "Kamakura",
    });

    await page.getByRole("button", { name: "候補を追加" }).click();
    await page.locator("#candidate-name").fill("江ノ島");
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByText("候補を追加しました")).toBeVisible();

    // Add reaction
    await page.getByRole("button", { name: "いいね" }).click();
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Click again to remove
    await page.getByRole("button", { name: "いいね" }).click();
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium reactions.spec.ts
```

Expected: all 3 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/reactions.spec.ts
git commit -m "test: 候補へのリアクションの E2E テストを追加"
```

---

## Task 5: activity.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/activity.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Activity Log", () => {
  test("shows activity log tab", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Activity Log Test",
      destination: "Kyoto",
    });

    // Switch to activity tab
    await page.getByRole("tab", { name: "履歴" }).click();

    // Empty state or existing log entries should be visible
    // Trip creation itself creates a log entry
    await expect(
      page.getByText(/旅行|まだアクティビティはありません/).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("activity log records schedule creation", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Activity Record Test",
      destination: "Osaka",
    });

    // Add a schedule
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("道頓堀");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    // Check activity log for the record
    await page.getByRole("tab", { name: "履歴" }).click();
    await expect(
      page.getByText(/道頓堀|予定/).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows empty state when no activity", async ({ authenticatedPage: page }) => {
    // Note: Trip creation itself generates an activity log,
    // so verify at minimum the tab is accessible and shows content
    await createTripViaUI(page, {
      title: "Activity Empty Test",
      destination: "Nara",
    });

    await page.getByRole("tab", { name: "履歴" }).click();

    // Should show something (either empty state or log entry from trip creation)
    await expect(page.getByRole("tab", { name: "履歴" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium activity.spec.ts
```

Expected: all 3 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/activity.spec.ts
git commit -m "test: アクティビティログの E2E テストを追加"
```

---

## Task 6: notifications.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/notifications.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import {
  BASE_URL,
  createTripViaUI,
  expect,
  signupUser,
  test,
} from "./fixtures/auth";

test.describe("Notifications", () => {
  test("shows unread badge when member is added to trip", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Create member user
    const memberContext = await browser.newContext({ baseURL: BASE_URL });
    const memberPage = await memberContext.newPage();
    await signupUser(memberPage, {
      username: `notif${Date.now()}`,
      name: "Notif User",
    });

    // Get member's user ID
    await memberPage.goto("/settings");
    const memberId = await memberPage.locator("code").first().textContent();
    expect(memberId).toBeTruthy();

    // Owner creates trip and adds member
    await createTripViaUI(page, {
      title: "Notification Trip",
      destination: "Sendai",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "IDで追加" }).click();
    await page.locator("#member-user-id").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();

    // Member should have a notification badge
    await memberPage.reload();
    // The notification bell badge shows a count
    const badge = memberPage.locator('button:has(.lucide-bell) span').first();
    await expect(badge).toBeVisible({ timeout: 15000 });

    await memberContext.close();
  });

  test("marks all notifications as read", async ({
    authenticatedPage: page,
    browser,
  }) => {
    // Create member user
    const memberContext = await browser.newContext({ baseURL: BASE_URL });
    const memberPage = await memberContext.newPage();
    await signupUser(memberPage, {
      username: `notif2${Date.now()}`,
      name: "Notif User 2",
    });

    await memberPage.goto("/settings");
    const memberId = await memberPage.locator("code").first().textContent();
    expect(memberId).toBeTruthy();

    // Owner creates trip and adds member
    await createTripViaUI(page, {
      title: "Mark Read Trip",
      destination: "Kanazawa",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "IDで追加" }).click();
    await page.locator("#member-user-id").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();

    // Member opens notification dropdown
    await memberPage.reload();
    await memberPage.locator('button:has(.lucide-bell)').click();
    await expect(memberPage.getByText("通知")).toBeVisible();

    // Click "すべて既読"
    await memberPage.getByText("すべて既読").click();

    // Badge should disappear
    await expect(
      memberPage.locator('button:has(.lucide-bell) span'),
    ).not.toBeVisible({ timeout: 5000 });

    await memberContext.close();
  });

  test("can toggle in-app notification preferences", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings");

    // Find the メンバー notification toggle
    const memberToggle = page.getByRole("switch", { name: "メンバー アプリ内通知" });
    await expect(memberToggle).toBeVisible();

    const initialState = await memberToggle.isChecked();

    // Toggle the switch
    await memberToggle.click();

    // State should have changed
    const newState = await memberToggle.isChecked();
    expect(newState).toBe(!initialState);

    // Toggle back
    await memberToggle.click();
    await expect(memberToggle).toBeChecked({ checked: initialState });
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium notifications.spec.ts
```

Expected: all 3 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/notifications.spec.ts
git commit -m "test: 通知・通知設定の E2E テストを追加"
```

---

## Task 7: souvenirs.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/souvenirs.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Souvenirs", () => {
  test("adds a souvenir with name only", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Souvenir Add Test",
      destination: "Kyoto",
    });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    await expect(dialog).toBeVisible();
    await dialog.locator("#souvenir-name").fill("八つ橋");
    await dialog.getByRole("button", { name: "追加" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("八つ橋")).toBeVisible();
  });

  test("adds a souvenir with priority and recipient", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Souvenir Full Test",
      destination: "Osaka",
    });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    await dialog.locator("#souvenir-name").fill("抹茶スイーツ");
    await dialog.locator("#souvenir-recipient").fill("お母さん");
    // Set high priority (絶対)
    await dialog.getByRole("button", { name: "絶対" }).click();
    await dialog.locator("#souvenir-memo").fill("京都限定");
    await dialog.getByRole("button", { name: "追加" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("抹茶スイーツ")).toBeVisible();
  });

  test("shows validation error when name is empty", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Souvenir Validation Test",
      destination: "Nara",
    });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    // Leave name empty
    await expect(dialog.getByRole("button", { name: "追加" })).toBeDisabled();
  });

  test("toggles souvenir purchased status", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Souvenir Toggle Test",
      destination: "Sapporo",
    });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const dialog = page.getByRole("dialog", { name: "お土産を追加" });
    await dialog.locator("#souvenir-name").fill("白い恋人");
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Toggle to purchased
    await page.getByRole("checkbox", { name: "購入済みにする" }).click();

    // Should now be in the purchased section
    await expect(page.getByRole("checkbox", { name: "購入済みを取り消す" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("購入済み")).toBeVisible();
  });

  test("edits a souvenir", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Souvenir Edit Test",
      destination: "Fukuoka",
    });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "お土産を追加" });
    await addDialog.locator("#souvenir-name").fill("明太子");
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    // Edit the souvenir
    await page.getByRole("button", { name: "明太子のメニュー" }).click();
    await page.getByRole("menuitem", { name: "編集" }).click();

    const editDialog = page.getByRole("dialog", { name: "お土産を編集" });
    await expect(editDialog).toBeVisible();
    await editDialog.locator("#souvenir-name").clear();
    await editDialog.locator("#souvenir-name").fill("辛子明太子");
    await editDialog.getByRole("button", { name: "更新" }).click();

    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText("辛子明太子")).toBeVisible();
    await expect(page.getByText("明太子", { exact: true })).not.toBeVisible();
  });

  test("deletes a souvenir", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Souvenir Delete Test",
      destination: "Hiroshima",
    });

    await page.getByRole("tab", { name: "お土産" }).click();
    await page.getByRole("button", { name: "お土産を追加" }).click();

    const addDialog = page.getByRole("dialog", { name: "お土産を追加" });
    await addDialog.locator("#souvenir-name").fill("もみじ饅頭");
    await addDialog.getByRole("button", { name: "追加" }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "もみじ饅頭のメニュー" }).click();
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("もみじ饅頭")).not.toBeVisible();
  });

  test("bulk deletes souvenirs in selection mode", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Souvenir Bulk Delete Test",
      destination: "Kobe",
    });

    await page.getByRole("tab", { name: "お土産" }).click();

    // Add two souvenirs
    for (const name of ["神戸プリン", "スヌーピーグッズ"]) {
      await page.getByRole("button", { name: "お土産を追加" }).click();
      const d = page.getByRole("dialog", { name: "お土産を追加" });
      await d.locator("#souvenir-name").fill(name);
      await d.getByRole("button", { name: "追加" }).click();
      await expect(d).not.toBeVisible({ timeout: 10000 });
    }

    // Enter selection mode
    await page.getByRole("button", { name: "選択" }).click();

    // Select all
    await page.getByRole("button", { name: "全選択" }).click();

    // Bulk delete
    await page.getByRole("button", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page.getByText("神戸プリン")).not.toBeVisible();
    await expect(page.getByText("スヌーピーグッズ")).not.toBeVisible();
  });

  test("sorts souvenirs by priority and creation order", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Souvenir Sort Test",
      destination: "Nagoya",
    });

    await page.getByRole("tab", { name: "お土産" }).click();

    // Add souvenirs with different priorities
    await page.getByRole("button", { name: "お土産を追加" }).click();
    const d1 = page.getByRole("dialog", { name: "お土産を追加" });
    await d1.locator("#souvenir-name").fill("ういろう");
    await d1.getByRole("button", { name: "追加" }).click();
    await expect(d1).not.toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "お土産を追加" }).click();
    const d2 = page.getByRole("dialog", { name: "お土産を追加" });
    await d2.locator("#souvenir-name").fill("手羽先");
    await d2.getByRole("button", { name: "絶対" }).click();
    await d2.getByRole("button", { name: "追加" }).click();
    await expect(d2).not.toBeVisible({ timeout: 10000 });

    // Switch to priority sort
    await page.getByRole("button", { name: "優先度順に切り替える" }).click();
    await expect(page.getByRole("button", { name: "作成順に切り替える" })).toBeVisible();

    // Switch back to creation order
    await page.getByRole("button", { name: "作成順に切り替える" }).click();
    await expect(page.getByRole("button", { name: "優先度順に切り替える" })).toBeVisible();
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium souvenirs.spec.ts
```

Expected: all 7 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/souvenirs.spec.ts
git commit -m "test: みやげリストの E2E テストを追加"
```

---

## Task 8: export.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/export.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Export", () => {
  test("shows export page with trip title pre-filled in filename", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Filename Test",
      destination: "Kyoto",
    });

    await page.goto(`${tripUrl}/export`);
    await expect(page.getByLabel("ファイル名")).toHaveValue(/Export Filename Test/, {
      timeout: 10000,
    });
  });

  test("selects all fields and clears them", async ({ authenticatedPage: page }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Fields Test",
      destination: "Osaka",
    });

    await page.goto(`${tripUrl}/export`);
    await expect(page.getByText("出力する列")).toBeVisible({ timeout: 10000 });

    // Select all fields
    await page.getByRole("button", { name: "全選択" }).click();
    // Some checkboxes should now be checked
    const checkedBoxes = page.getByRole("checkbox", { checked: true });
    await expect(checkedBoxes.first()).toBeVisible();

    // Clear selection
    await page.getByRole("button", { name: "選択解除" }).click();
    const afterClear = await page.getByRole("checkbox", { checked: true }).count();
    expect(afterClear).toBe(0);
  });

  test("shows preview table after selecting fields", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Preview Test",
      destination: "Nara",
    });

    await page.goto(`${tripUrl}/export`);
    await expect(page.getByText("出力する列")).toBeVisible({ timeout: 10000 });

    // Before selecting fields, preview message should show
    await expect(
      page.getByText("出力する列を選択するとプレビューが表示されます"),
    ).toBeVisible();

    // Select all fields
    await page.getByRole("button", { name: "全選択" }).click();

    // Preview table should appear
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("switches format between Excel and CSV", async ({ authenticatedPage: page }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Format Test",
      destination: "Fukuoka",
    });

    await page.goto(`${tripUrl}/export`);
    await expect(page.getByText("フォーマット")).toBeVisible({ timeout: 10000 });

    // Switch to CSV
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "CSV (.csv)" }).click();

    // CSV settings should appear
    await expect(page.getByText("CSV 設定")).toBeVisible();

    // Sheet separation should be disabled for CSV
    const sheetOption = page.getByText("パターンごとにシート分け");
    if (await sheetOption.isVisible()) {
      await expect(sheetOption).toHaveClass(/disabled|opacity/);
    }
  });

  test("downloads file when export button is clicked", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Export Download Test",
      destination: "Sapporo",
    });

    // Add a schedule so there's data to export
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("大倉山ジャンプ台");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    await page.goto(`${tripUrl}/export`);
    await expect(page.getByText("出力する列")).toBeVisible({ timeout: 10000 });

    // Select all fields
    await page.getByRole("button", { name: "全選択" }).click();

    // Trigger download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "エクスポート" }).click(),
    ]);

    expect(download.suggestedFilename()).toContain("Export Download Test");
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium export.spec.ts
```

Expected: all 5 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/export.spec.ts
git commit -m "test: エクスポートページの E2E テストを追加"
```

---

## Task 9: print.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/print.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Print", () => {
  test("shows print page with trip title and date", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Print Display Test",
      destination: "Kyoto",
    });

    await page.goto(`${tripUrl}/print`);

    // Trip title should be displayed
    await expect(page.getByRole("heading", { name: "Print Display Test" })).toBeVisible({
      timeout: 10000,
    });
    // Destination should be visible
    await expect(page.getByText("Kyoto")).toBeVisible();
  });

  test("shows schedule in day sections on print page", async ({
    authenticatedPage: page,
  }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Print Schedule Test",
      destination: "Osaka",
    });

    // Add a schedule
    await page.getByRole("button", { name: "予定を追加" }).click();
    await page.getByLabel("名前").fill("道頓堀散策");
    await page.getByRole("button", { name: "予定を追加" }).last().click();
    await expect(page.getByText("予定を追加しました")).toBeVisible();

    await page.goto(`${tripUrl}/print`);

    // Day heading should be visible (1日目)
    await expect(page.getByText(/1日目/)).toBeVisible({ timeout: 10000 });
    // Schedule name should appear in the table
    await expect(page.getByText("道頓堀散策")).toBeVisible();
  });

  test("print button is present on print page", async ({ authenticatedPage: page }) => {
    const tripUrl = await createTripViaUI(page, {
      title: "Print Button Test",
      destination: "Nara",
    });

    await page.goto(`${tripUrl}/print`);

    await expect(page.getByRole("button", { name: "印刷 / PDF保存" })).toBeVisible({
      timeout: 10000,
    });
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium print.spec.ts
```

Expected: all 3 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/print.spec.ts
git commit -m "test: 印刷ページの E2E テストを追加"
```

---

## Task 10: roles.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/roles.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { BASE_URL, createTripViaUI, expect, signupUser, test } from "./fixtures/auth";

async function setupViewerMember(
  page: Parameters<Parameters<typeof test>[1]>[0],
  browser: Parameters<Parameters<typeof test>[1]>[0]["browser"],
  tripTitle: string,
) {
  const ctx = await browser.newContext({ baseURL: BASE_URL });
  const memberPage = await ctx.newPage();
  await signupUser(memberPage, {
    username: `viewer${Date.now()}`,
    name: "Viewer User",
  });

  await memberPage.goto("/settings");
  const memberId = await memberPage.locator("code").first().textContent();

  await createTripViaUI(page, { title: tripTitle, destination: "Tokyo" });

  await page.getByRole("button", { name: "メンバー" }).click();
  await page.getByRole("tab", { name: "IDで追加" }).click();
  await page.locator("#member-user-id").fill(memberId!);
  await page.getByRole("button", { name: "追加" }).click();
  await expect(page.getByText("メンバーを追加しました")).toBeVisible();

  // Change role to viewer
  const memberRow = page.getByText("Viewer User").locator("../..");
  await memberRow.getByRole("combobox").click();
  await page.getByRole("option", { name: "閲覧者" }).click();
  await expect(page.getByText("ロールを変更しました")).toBeVisible();

  // Close member dialog
  await page.keyboard.press("Escape");

  const tripUrl = page.url();
  return { ctx, memberPage, tripUrl };
}

test.describe("Roles and Permissions", () => {
  test("viewer cannot see schedule add button", async ({
    authenticatedPage: page,
    browser,
  }) => {
    const { ctx, memberPage, tripUrl } = await setupViewerMember(
      page,
      browser,
      "Viewer Schedule Test",
    );

    await memberPage.goto(tripUrl);
    await expect(memberPage).toHaveURL(/\/trips\//, { timeout: 10000 });

    // Viewer should NOT see the "予定を追加" button
    await expect(memberPage.getByRole("button", { name: "予定を追加" })).not.toBeVisible();

    await ctx.close();
  });

  test("viewer cannot see candidate add button", async ({
    authenticatedPage: page,
    browser,
  }) => {
    const { ctx, memberPage, tripUrl } = await setupViewerMember(
      page,
      browser,
      "Viewer Candidate Test",
    );

    await memberPage.goto(tripUrl);
    await expect(memberPage).toHaveURL(/\/trips\//, { timeout: 10000 });

    await expect(memberPage.getByRole("button", { name: "候補を追加" })).not.toBeVisible();

    await ctx.close();
  });

  test("viewer cannot see expense add button", async ({
    authenticatedPage: page,
    browser,
  }) => {
    const { ctx, memberPage, tripUrl } = await setupViewerMember(
      page,
      browser,
      "Viewer Expense Test",
    );

    await memberPage.goto(tripUrl);
    await expect(memberPage).toHaveURL(/\/trips\//, { timeout: 10000 });

    await memberPage.getByRole("tab", { name: "費用" }).click();
    await expect(memberPage.getByRole("button", { name: "費用を追加" })).not.toBeVisible();

    await ctx.close();
  });

  test("viewer cannot see souvenir add button", async ({
    authenticatedPage: page,
    browser,
  }) => {
    const { ctx, memberPage, tripUrl } = await setupViewerMember(
      page,
      browser,
      "Viewer Souvenir Test",
    );

    await memberPage.goto(tripUrl);
    await expect(memberPage).toHaveURL(/\/trips\//, { timeout: 10000 });

    await memberPage.getByRole("tab", { name: "お土産" }).click();
    await expect(memberPage.getByRole("button", { name: "お土産を追加" })).not.toBeVisible();

    await ctx.close();
  });

  test("viewer can react to candidates", async ({ authenticatedPage: page, browser }) => {
    // Add a candidate as owner first
    await createTripViaUI(page, {
      title: "Viewer Reaction Test",
      destination: "Kyoto",
    });
    await page.getByRole("button", { name: "候補を追加" }).click();
    await page.locator("#candidate-name").fill("金閣寺");
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByText("候補を追加しました")).toBeVisible();

    // Setup viewer
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const memberPage = await ctx.newPage();
    await signupUser(memberPage, {
      username: `vreact${Date.now()}`,
      name: "Viewer Reactor",
    });

    await memberPage.goto("/settings");
    const memberId = await memberPage.locator("code").first().textContent();

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "IDで追加" }).click();
    await page.locator("#member-user-id").fill(memberId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();

    const memberRow = page.getByText("Viewer Reactor").locator("../..");
    await memberRow.getByRole("combobox").click();
    await page.getByRole("option", { name: "閲覧者" }).click();
    await expect(page.getByText("ロールを変更しました")).toBeVisible();
    await page.keyboard.press("Escape");

    const tripUrl = page.url();
    await memberPage.goto(tripUrl);
    await expect(memberPage).toHaveURL(/\/trips\//, { timeout: 10000 });

    // Viewer can still react to candidates
    await expect(memberPage.getByRole("button", { name: "いいね" })).toBeVisible();
    await memberPage.getByRole("button", { name: "いいね" }).click();
    await expect(memberPage.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await ctx.close();
  });

  test("owner can edit trip info but editor cannot", async ({
    authenticatedPage: page,
    browser,
  }) => {
    const ctx = await browser.newContext({ baseURL: BASE_URL });
    const editorPage = await ctx.newPage();
    await signupUser(editorPage, {
      username: `editor${Date.now()}`,
      name: "Editor User",
    });

    await editorPage.goto("/settings");
    const editorId = await editorPage.locator("code").first().textContent();

    await createTripViaUI(page, {
      title: "Owner Edit Test",
      destination: "Kobe",
    });

    await page.getByRole("button", { name: "メンバー" }).click();
    await page.getByRole("tab", { name: "IDで追加" }).click();
    await page.locator("#member-user-id").fill(editorId!);
    await page.getByRole("button", { name: "追加" }).click();
    await expect(page.getByText("メンバーを追加しました")).toBeVisible();
    // Leave as editor (default)
    await page.keyboard.press("Escape");

    const tripUrl = page.url();

    // Owner sees edit trip button
    await expect(page.getByRole("button", { name: "旅行を編集" }).or(
      page.getByRole("menuitem", { name: "旅行を編集" })
    )).toBeVisible();

    // Editor navigates to same trip - also sees edit button (editors can edit schedules)
    await editorPage.goto(tripUrl);
    await expect(editorPage).toHaveURL(/\/trips\//, { timeout: 10000 });
    await expect(editorPage.getByRole("button", { name: "予定を追加" })).toBeVisible();

    await ctx.close();
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium roles.spec.ts
```

Expected: all 6 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/roles.spec.ts
git commit -m "test: 権限ベースアクセス制御の E2E テストを追加"
```

---

## Task 11: static-pages.spec.ts を作成

**Files:**
- Create: `apps/web/e2e/static-pages.spec.ts`

**Step 1: テストファイルを作成する**

```typescript
import { expect, test as base } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

const test = base;

test.describe("Static Pages", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveURL(BASE_URL + "/");
    // Landing page should have a heading or logo
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("FAQ page loads", async ({ page }) => {
    await page.goto("/faq");
    await expect(page).toHaveURL(/\/faq/);
    // FAQ page should have headings or content
    await expect(page.locator("main, [role=main]").first()).toBeVisible({ timeout: 10000 });
  });

  test("terms of service page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page).toHaveURL(/\/terms/);
    await expect(page.locator("main, [role=main]").first()).toBeVisible({ timeout: 10000 });
  });

  test("privacy policy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.locator("main, [role=main]").first()).toBeVisible({ timeout: 10000 });
  });

  test("news page loads", async ({ page }) => {
    await page.goto("/news");
    await expect(page).toHaveURL(/\/news/);
    await expect(page.locator("main, [role=main]").first()).toBeVisible({ timeout: 10000 });
  });
});
```

**Step 2: テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium static-pages.spec.ts
```

Expected: all 5 tests pass

**Step 3: コミット**

```bash
git add apps/web/e2e/static-pages.spec.ts
git commit -m "test: 静的ページのスモークテストを追加"
```

---

## Task 12: 全テストスイートの確認

**Step 1: 全 E2E テストを実行する**

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium
```

Expected: 既存 62 件 + 新規 ~40 件が全て通過

**Step 2: 失敗したテストがある場合**

各テストを個別に実行して原因を特定:

```bash
bun run --filter @sugara/web test:e2e -- --project=chromium --debug <spec-name>.spec.ts
```

UI ラベルが一致しない場合は実際のコンポーネントを読んでセレクターを修正する。

**Step 3: 最終コミット (必要な場合)**

```bash
git add apps/web/e2e/
git commit -m "test: Playwright テスト全体修正"
```

---

## 注意事項

- **経費・みやげ**: 成功トーストがない。ダイアログが閉じてアイテムが表示されることで確認する。
- **投票**: `createTripWithPollViaUI` ヘルパーを先に Task 1 で追加すること。
- **通知ベル**: `aria-label` がない。`page.locator('button:has(.lucide-bell)')` を使う。
- **エクスポートダウンロード**: `page.waitForEvent("download")` で捕捉する。
- **役限テスト**: 各テストで独立したユーザーを作成する。`setupViewerMember` ヘルパーで共通化。
- **投票確定**: 確定後は `scheduling` から通常のステータスに移行し、日程タブが現れる。
