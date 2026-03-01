import { createTripViaUI, expect, test } from "./fixtures/auth";

test.describe("Reactions", () => {
  test("adds a like reaction to a candidate", async ({ authenticatedPage: page }) => {
    await createTripViaUI(page, {
      title: "Reaction Like Test",
      destination: "Kamakura",
    });

    await page.getByRole("button", { name: "候補を追加" }).click();
    await page.locator("#candidate-name").fill("鶴岡八幡宮");
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByText("候補を追加しました")).toBeVisible();

    await page.getByRole("button", { name: "いいね" }).click();

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

    await page.getByRole("button", { name: "いいね" }).click();
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Switch to うーん (removes いいね and adds うーん)
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

    await page.getByRole("button", { name: "いいね" }).click();
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Click again to remove reaction
    await page.getByRole("button", { name: "いいね" }).click();
    await expect(page.getByRole("button", { name: "いいね" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
