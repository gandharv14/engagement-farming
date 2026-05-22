import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import { cleanupByPrefix, createE2EUser, hasSupabaseAdminEnv, seedPayoutEarning } from "./support/db";
import { dismissRulesModal } from "./support/rules";

test.describe("admin ops surfaces", () => {
  test.skip(!hasStorageState("admin"), "Missing e2e/.auth/admin.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("admin") });

  test("renders the core operations pages", async ({ page }) => {
    const pages = [
      { path: "/admin", heading: "Program Operations" },
      { path: "/admin/config", heading: "Sprint Config" },
      { path: "/admin/economics", heading: "Program Economics" },
      { path: "/admin/taskers", heading: "Taskers" },
      { path: "/admin/reviewers", heading: "Reviewers" },
      { path: "/admin/payouts", heading: "Payout Export" },
    ];

    for (const adminPage of pages) {
      await page.goto(adminPage.path);
      await dismissRulesModal(page);
      await expect(page.getByRole("heading", { name: adminPage.heading })).toBeVisible();
    }
  });
});

test.describe("admin payout export", () => {
  test.skip(!hasStorageState("admin"), "Missing e2e/.auth/admin.json. See docs/e2e-testing.md.");
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e seed/cleanup.");
  test.use({ storageState: storageStatePath("admin") });

  test("exports grouped earnings CSV for finance", async ({ page }, testInfo) => {
    const prefix = `e2e-payout-${testInfo.workerIndex}-${Date.now()}`;
    await cleanupByPrefix(prefix);
    const user = await createE2EUser(prefix);
    await seedPayoutEarning(user.id, randomUUID(), 600);
    await seedPayoutEarning(user.id, randomUUID(), 511);

    const response = await page.context().request.get("/admin/payouts/export");
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("text/csv");

    const csv = await response.text();
    expect(csv.split("\n")).toContain('"user_id","email","display_name","amount_cents"');
    expect(csv.split("\n")).toContain(`"${user.id}","${user.email}","${user.display_name}","1111"`);

    await cleanupByPrefix(prefix);
  });
});
