import { expect, test } from "@playwright/test";

import { dismissRulesModal } from "./support/rules";
import {
  ensureE2EBypassUser,
  getE2ESprintConfig,
  hasSupabaseAdminEnv,
  updateE2ESprintConfig,
} from "./support/db";

test.describe("sprint ending", () => {
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e config setup.");

  test("schedules the June 5 end date and shows the ended tasker state", async ({ browser }) => {
    const originalConfig = await getE2ESprintConfig();

    try {
      await Promise.all([ensureE2EBypassUser("admin"), ensureE2EBypassUser("tasker")]);

      const adminContext = await browser.newContext({ extraHTTPHeaders: { "x-e2e-role": "admin" } });
      const adminPage = await adminContext.newPage();
      await adminPage.goto("/admin/config");
      await dismissRulesModal(adminPage);
      await expect(adminPage.getByText("Admin-managed incentives and phase controls.")).toBeVisible();

      await adminPage.getByLabel("Sprint end date").fill("2026-06-05");
      await adminPage.getByLabel("Current phase").selectOption("finale");
      await adminPage.getByRole("button", { name: "Save config" }).click();
      await expect(adminPage.getByText(/Config saved/)).toBeVisible();
      await expect(adminPage.getByLabel("Sprint end date")).toHaveValue("2026-06-05");
      await adminContext.close();

      const taskerContext = await browser.newContext({ extraHTTPHeaders: { "x-e2e-role": "tasker" } });
      const taskerPage = await taskerContext.newPage();
      await taskerPage.goto("/");
      await dismissRulesModal(taskerPage);
      await expect(taskerPage.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();
      await expect(taskerPage.getByText("This sprint will end on Friday, June 5. Be back very soon.")).toBeVisible();
      await expect(taskerPage.getByRole("button", { name: "Submit Sprint Entry" })).toBeVisible();

      await updateE2ESprintConfig({ current_phase: "finale", sprint_end_date: "2026-06-01" });
      await taskerPage.reload();
      await dismissRulesModal(taskerPage);
      await expect(taskerPage.getByRole("heading", { name: "This sprint has ended." })).toBeVisible();
      await expect(taskerPage.getByText("This sprint ended on Monday, June 1. Be back very soon.").first()).toBeVisible();
      await expect(taskerPage.getByText("Sprint Submissions Paused")).toBeVisible();
      await expect(taskerPage.getByRole("button", { name: "Submit Sprint Entry" })).toHaveCount(0);
      await taskerContext.close();
    } finally {
      await updateE2ESprintConfig(originalConfig);
    }
  });
});
