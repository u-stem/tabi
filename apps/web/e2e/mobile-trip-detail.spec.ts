import type { Locator, Page } from "@playwright/test";
import { createTripViaUI, expect, test } from "./fixtures/auth";

async function openAddScheduleDialog(page: Page): Promise<Locator> {
  await page.locator('button[aria-label="予定を追加"]').click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const nameInput = page.getByLabel("名前").last();
  await expect(nameInput).toBeVisible();
  const dialog = nameInput.locator("xpath=ancestor::*[@role='dialog']").first();
  return dialog;
}

async function addSchedule(page: Page, name: string): Promise<void> {
  const dialog = await openAddScheduleDialog(page);
  await dialog.getByLabel("名前").fill(name);
  await dialog.getByRole("button", { name: "予定を追加" }).click();
  await expect(page.getByText("予定を追加しました").first()).toBeVisible();
}

async function clickFirstEnabled(locator: Locator): Promise<void> {
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    if (await locator.nth(i).isEnabled()) {
      await locator.nth(i).click();
      return;
    }
  }
  throw new Error("No enabled button found");
}

async function clickTripMenuAction(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: "旅行メニュー" }).click();
  const action = page.getByRole("button", { name: label }).first();
  await expect(action).toBeVisible();
  await action.click();
}

test.describe("Mobile trip detail", () => {
  test("schedule form remains editable after category change", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Mobile Form Test",
      destination: "Kyoto",
    });

    const dialog = await openAddScheduleDialog(page);
    await dialog.getByLabel("名前").fill("移動テスト");

    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "移動" }).click();

    await dialog.getByLabel("出発地").fill("東京駅");
    await dialog.getByLabel("到着地").fill("新大阪駅");
    await dialog.getByLabel("メモ").fill("下の入力欄まで操作できること");

    await expect(dialog.getByLabel("出発地")).toHaveValue("東京駅");
    await expect(dialog.getByLabel("到着地")).toHaveValue("新大阪駅");
    await expect(dialog.getByLabel("メモ")).toHaveValue("下の入力欄まで操作できること");
  });

  test("day 2 shows reorder controls and item reorder works", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Mobile Reorder Test",
      destination: "Osaka",
    });

    await page.getByRole("tab", { name: /2日目/ }).click();
    await addSchedule(page, "Day2-A");
    await addSchedule(page, "Day2-B");

    await expect(page.getByRole("button", { name: "並び替え" })).toBeVisible();
    await expect(page.getByRole("button", { name: "時刻順" })).toBeVisible();

    const aMenu = page.getByRole("button", { name: "Day2-Aのメニュー" });
    const bMenu = page.getByRole("button", { name: "Day2-Bのメニュー" });
    const aYBefore = (await aMenu.boundingBox())?.y ?? 0;
    const bYBefore = (await bMenu.boundingBox())?.y ?? 0;
    expect(bYBefore).toBeGreaterThan(aYBefore);

    await page.getByRole("button", { name: "並び替え" }).click();
    await clickFirstEnabled(page.getByRole("button", { name: "上に移動" }));

    await expect
      .poll(async () => {
        const aY = (await aMenu.boundingBox())?.y ?? 0;
        const bY = (await bMenu.boundingBox())?.y ?? 0;
        return bY < aY;
      })
      .toBe(true);

    await clickFirstEnabled(page.getByRole("button", { name: "下に移動" }));

    await expect
      .poll(async () => {
        const aY = (await aMenu.boundingBox())?.y ?? 0;
        const bY = (await bMenu.boundingBox())?.y ?? 0;
        return aY < bY;
      })
      .toBe(true);
  });

  test("opens bookmarks/activity from menu and can return to primary tabs", async ({
    authenticatedPage: page,
  }) => {
    await createTripViaUI(page, {
      title: "Mobile Menu Test",
      destination: "Nara",
    });

    await clickTripMenuAction(page, "ブックマーク");
    await expect(
      page.getByText(/ブックマークリストがありません|日程が確定するとブックマークを利用できます/),
    ).toBeVisible();

    await page.getByRole("tab", { name: "予定" }).click();
    await expect(page.getByText("まだ予定がありません").first()).toBeVisible();

    await clickTripMenuAction(page, "履歴");
    await expect(page.getByText(/まだ履歴がありません|旅行「.*」を作成/).first()).toBeVisible();

    await page.getByRole("tab", { name: "作戦会議" }).click();
    await expect(page.getByPlaceholder("メッセージを入力...")).toBeVisible();
  });
});
