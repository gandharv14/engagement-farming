import { expect, test } from "@playwright/test";

const protectedRoutes = ["/", "/admin", "/review/queue", "/goodies", "/api/supabase-token"] as const;

for (const route of protectedRoutes) {
  test(`redirects ${route} to login when signed out`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("Sign in to Tokenmaxxing")).toBeVisible();
  });
}

test("shows the SSO error state on the login page", async ({ page }) => {
  await page.goto("/login?error=sso");

  await expect(page.getByText("Sign in to Tokenmaxxing")).toBeVisible();
  await expect(page.getByText("SSO could not complete")).toBeVisible();
});
