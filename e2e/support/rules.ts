import { expect, type Page } from "@playwright/test";

export async function dismissRulesModal(page: Page) {
  const startButton = page.getByRole("button", { name: "Start maxxing" });
  const isVisible = await startButton
    .waitFor({ state: "visible", timeout: 1000 })
    .then(() => true)
    .catch(() => false);

  if (isVisible) {
    await expect(startButton).toBeVisible();
    await startButton.click();
  }
}
