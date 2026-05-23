import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import {
  acceptRow,
  cleanupByPrefix,
  createE2EUser,
  getE2EEmail,
  getRowReview,
  getRowStatus,
  getStreakForUser,
  hasSupabaseAdminEnv,
  reserveRowForUserId,
  seedPendingRowForTasker,
  seedPendingRowForUserId,
} from "./support/db";
import { dismissRulesModal } from "./support/rules";

test.describe("reviewer outcomes", () => {
  test.skip(!hasStorageState("reviewer"), "Missing e2e/.auth/reviewer.json. See docs/e2e-testing.md.");
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e seed/cleanup.");
  test.skip(!getE2EEmail("tasker"), "Missing E2E_TASKER_EMAIL.");
  test.use({ storageState: storageStatePath("reviewer") });

  test("passes a reserved row and persists reviewer notes", async ({ page }, testInfo) => {
    const prefix = `e2e-pass-${testInfo.workerIndex}-${Date.now()}`;
    await cleanupByPrefix(prefix);
    const rowId = await seedPendingRowForTasker(getE2EEmail("tasker")!, prefix);

    await page.goto("/review/queue");
    await dismissRulesModal(page);
    const queuedRow = page.getByRole("row", { name: new RegExp(`${prefix}-pending`) });
    await expect(queuedRow).toBeVisible();
    await queuedRow.getByRole("button", { name: "Reserve" }).click();
    await expect(page.getByRole("heading", { name: "Review Row" })).toBeVisible();
    await expect(page.getByText("Potential streak if accepted")).toBeVisible();
    await expect(page.getByText("Reservation expires in")).toBeVisible();
    await expect(page.getByLabel("Reviewer score")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Accept with Edits" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Fail" })).toBeVisible();
    await page.getByLabel("Optional notes").fill("Looks good from Playwright.");
    await page.getByRole("button", { name: "Pass" }).click();
    await expect(page).toHaveURL(/\/review\/queue/);

    await expect.poll(() => getRowStatus(rowId)).toMatchObject({
      status: "accepted_clean",
      reserved_by: null,
      reserved_until: null,
    });
    await expect.poll(() => getRowReview(rowId)).toMatchObject({
      notes: "Looks good from Playwright.",
    });

    await cleanupByPrefix(prefix);
  });

  test("rejects a row and removes it from the pending queue", async ({ page }, testInfo) => {
    const prefix = `e2e-reject-${testInfo.workerIndex}-${Date.now()}`;
    await cleanupByPrefix(prefix);
    const rowId = await seedPendingRowForTasker(getE2EEmail("tasker")!, prefix);

    await page.goto("/review/queue");
    await dismissRulesModal(page);
    const queuedRow = page.getByRole("row", { name: new RegExp(`${prefix}-pending`) });
    await expect(queuedRow).toBeVisible();
    await queuedRow.getByRole("button", { name: "Reserve" }).click();
    await expect(page.getByLabel("Reviewer score")).toHaveCount(0);
    await page.getByLabel("Optional notes").fill("Rejecting from Playwright.");
    await page.getByRole("button", { name: "Fail" }).click();
    await expect(page).toHaveURL(/\/review\/queue/);

    await expect.poll(() => getRowStatus(rowId)).toMatchObject({
      status: "rejected",
      reserved_by: null,
      reserved_until: null,
    });
    await expect(page.getByRole("row", { name: new RegExp(`${prefix}-pending`) })).toHaveCount(0);

    await cleanupByPrefix(prefix);
  });

  test("returns an expired reservation to the queue", async ({ page }, testInfo) => {
    const prefix = `e2e-expired-${testInfo.workerIndex}-${Date.now()}`;
    await cleanupByPrefix(prefix);

    try {
      const temporaryReviewer = await createE2EUser(prefix, "reviewer");
      const rowId = await seedPendingRowForTasker(getE2EEmail("tasker")!, prefix);
      await reserveRowForUserId(rowId, temporaryReviewer.id, new Date(Date.now() - 60_000).toISOString());

      await page.goto("/review/queue");
      await dismissRulesModal(page);

      const queuedRow = page.getByRole("row", { name: new RegExp(`${prefix}-pending`) });
      await expect(queuedRow).toBeVisible();
      await expect(queuedRow.getByRole("button", { name: "Reserve" })).toBeVisible();

      await expect.poll(() => getRowStatus(rowId)).toMatchObject({
        reserved_by: null,
        reserved_until: null,
      });
    } finally {
      await cleanupByPrefix(prefix);
    }
  });

  test("shows not found for an unknown row", async ({ page }) => {
    await page.goto(`/review/${randomUUID()}`);

    await expect(page.getByText(/404|This page could not be found/i)).toBeVisible();
  });

  test("uses submitted date for streak when review lands late", async ({ request }, testInfo) => {
    void request;

    const prefix = `e2e-streak-${testInfo.workerIndex}-${Date.now()}`;
    await cleanupByPrefix(prefix);

    try {
      const tasker = await createE2EUser(prefix, "tasker");
      const day1RowId = await seedPendingRowForUserId(tasker.id, prefix, {
        problemSuffix: "day-1",
        submittedAt: "2026-02-01T12:00:00.000Z",
      });
      const day2RowId = await seedPendingRowForUserId(tasker.id, prefix, {
        problemSuffix: "day-2",
        submittedAt: "2026-02-02T12:00:00.000Z",
      });

      await acceptRow(day1RowId, "2026-02-01T13:00:00.000Z");
      await acceptRow(day2RowId, "2026-02-04T13:00:00.000Z");

      await expect.poll(() => getStreakForUser(tasker.id)).toMatchObject({
        current_streak_days: 2,
        longest_streak_days: 2,
        last_active_date: "2026-02-02",
        streak_started_on: "2026-02-01",
      });
    } finally {
      await cleanupByPrefix(prefix);
    }
  });
});
