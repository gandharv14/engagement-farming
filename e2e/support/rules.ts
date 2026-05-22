import { expect, type Page } from "@playwright/test";

export async function dismissRulesModal(page: Page) {
  const startButton = page.getByRole("button", { name: "Start maxxing" });
  await expect(startButton).toBeVisible();
  await startButton.click();
}
