import { expect, test } from "@playwright/test";

test("redirects protected pages to login when signed out", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText("Sign in to Sprint Arcade")).toBeVisible();
});
