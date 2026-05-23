import { expect, test } from "@playwright/test";

const adminTabs = [
  { label: "Operations", href: "/admin" },
  { label: "Admin Mode", href: "/admin/game-mode" },
  { label: "Reviewers", href: "/admin/reviewers" },
  { label: "Taskers", href: "/admin/taskers" },
  { label: "Config", href: "/admin/config" },
  { label: "Economics", href: "/admin/economics" },
  { label: "Goodies", href: "/admin/goodies" },
  { label: "Guilds", href: "/admin/guilds" },
  { label: "Payouts", href: "/admin/payouts" },
] as const;

test.describe("admin navigation", () => {
  test.use({ extraHTTPHeaders: { "x-e2e-role": "admin" } });

  test("keeps every admin tab visible across repeated initial loads", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Program Operations" })).toBeVisible();

      const navLinks = page.locator("aside nav a");
      await expect(navLinks).toHaveText(adminTabs.map((tab) => tab.label));

      for (const tab of adminTabs) {
        const link = page.getByRole("link", { name: tab.label });
        await expect(link).toBeVisible();
        await expect(link).toBeInViewport();
        await expect(link).toHaveAttribute("href", tab.href);
      }
    }
  });
});
