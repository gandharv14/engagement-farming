import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import {
  cleanupByPrefix,
  createGoodieForE2E,
  getE2EEmail,
  hasSupabaseAdminEnv,
  seedAcceptedRowsForTasker,
} from "./support/db";

test.describe("Goodie selection and fulfillment", () => {
  test.skip(!hasStorageState("admin"), "Missing e2e/.auth/admin.json. See docs/e2e-testing.md.");
  test.skip(!hasStorageState("tasker"), "Missing e2e/.auth/tasker.json. See docs/e2e-testing.md.");
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e seed/cleanup.");
  test.skip(!getE2EEmail("tasker"), "Missing E2E_TASKER_EMAIL.");

  test("lets taskers select a Goodie and admins mark it fulfilled", async ({ browser }, testInfo) => {
    const prefix = `e2e-fulfillment-${testInfo.workerIndex}-${Date.now()}`;
    const taskerEmail = getE2EEmail("tasker")!;
    await cleanupByPrefix(prefix);
    await seedAcceptedRowsForTasker(taskerEmail, prefix, 5);
    const goodie = await createGoodieForE2E(prefix);

    const taskerContext = await browser.newContext({ storageState: storageStatePath("tasker") });
    const taskerPage = await taskerContext.newPage();
    await taskerPage.goto("/goodies");
    await expect(taskerPage.getByRole("heading", { name: "Goodie Catalog" })).toBeVisible();
    await expect(taskerPage.getByText(goodie.name)).toBeVisible();
    await taskerPage.getByRole("button", { name: `Select ${goodie.name}` }).click();
    await expect(taskerPage.getByText("On the way")).toBeVisible();
    await taskerContext.close();

    const adminContext = await browser.newContext({ storageState: storageStatePath("admin") });
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/goodies");
    const fulfillmentRow = adminPage.getByRole("row", { name: new RegExp(goodie.name) });
    await expect(fulfillmentRow).toBeVisible();
    await fulfillmentRow.getByRole("button", { name: "Mark fulfilled" }).click();
    await expect(fulfillmentRow.getByText(/Fulfilled/)).toBeVisible();

    await fulfillmentRow.getByRole("button", { name: "Clear" }).click();
    await expect(fulfillmentRow.getByRole("button", { name: "Mark fulfilled" })).toBeVisible();
    await adminContext.close();

    await cleanupByPrefix(prefix);
  });
});
