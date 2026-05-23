import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import {
  cleanupByPrefix,
  getE2EEmail,
  hasSupabaseAdminEnv,
  seedPendingRowForTasker,
} from "./support/db";
import { dismissRulesModal } from "./support/rules";

test.describe("tasker surfaces", () => {
  test.skip(!hasStorageState("tasker"), "Missing e2e/.auth/tasker.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("tasker") });

  test("renders the main tasker pages", async ({ page }) => {
    await page.goto("/");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();

    await page.goto("/leaderboards");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Public Leaderboards" })).toBeVisible();

    await page.goto("/guild");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Guild Room" })).toBeVisible();

    await page.goto("/goodies");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Goodie Catalog" })).toBeVisible();

    await page.goto("/earnings");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Your Earnings Ledger" })).toBeVisible();

    await page.goto("/profile");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  });

  test.describe("submission flow", () => {
    test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e cleanup.");
    test.skip(!getE2EEmail("tasker"), "Missing E2E_TASKER_EMAIL.");

    test("records a submitted row", async ({ page }, testInfo) => {
      const prefix = `e2e-submit-${testInfo.workerIndex}-${Date.now()}`;
      await cleanupByPrefix(prefix);

      await page.goto("/");
      await dismissRulesModal(page);
      await page.getByLabel("Problem ID").fill(`${prefix}-row`);
      await page.getByRole("combobox", { name: "Task type" }).click();
      await page.getByRole("option", { name: "Debugging" }).click();
      await page.getByLabel("Token count").fill("3210");
      await page.getByLabel("Taiga problem link").fill(`https://taiga.example.com/project/live-compare/us/${prefix}`);
      await page.getByRole("button", { name: "Record submitted row" }).click();
      await expect(page.getByText(/submissions logged today\./)).toBeVisible();
      await expect(page.getByText(/Potential streak if pending rows pass:/)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Submitted Rows" })).toBeVisible();
      await expect(page.getByRole("row", { name: new RegExp(`${prefix}-row.*Debugging.*3,210.*Pending review`) })).toBeVisible();

      await cleanupByPrefix(prefix);
    });
  });
});

test.describe("reviewer flow", () => {
  test.skip(!hasStorageState("reviewer"), "Missing e2e/.auth/reviewer.json. See docs/e2e-testing.md.");
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e seed/cleanup.");
  test.skip(!getE2EEmail("tasker"), "Missing E2E_TASKER_EMAIL.");
  test.use({ storageState: storageStatePath("reviewer") });

  test("opens and reviews a queued row", async ({ page }, testInfo) => {
    const prefix = `e2e-review-${testInfo.workerIndex}-${Date.now()}`;
    await cleanupByPrefix(prefix);
    await seedPendingRowForTasker(getE2EEmail("tasker")!, prefix);

    await page.goto("/review/queue");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Streak if accepted" })).toBeVisible();
    const queuedRow = page.getByRole("row", { name: new RegExp(`${prefix}-pending.*Debugging.*4,242`) });
    await expect(queuedRow).toBeVisible();
    await queuedRow.getByRole("button", { name: "Reserve" }).click();

    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Review Row" })).toBeVisible();
    await expect(page.getByText("Reservation expires in")).toBeVisible();
    await expect(page.getByLabel("Reviewer score")).toHaveCount(0);
    await page.getByLabel("Optional notes").fill("E2E clean pass");
    await page.getByRole("button", { name: "Pass" }).click();
    await expect(page).toHaveURL(/\/review\/queue/);

    await cleanupByPrefix(prefix);
  });
});
