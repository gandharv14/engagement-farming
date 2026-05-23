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

test("gives signed-out users a way back from unknown pages", async ({ page }) => {
  await page.goto("/missing-navigation-route");

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to continue" })).toHaveAttribute("href", "/login");
});
