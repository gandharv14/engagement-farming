import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import {
  cleanupByPrefix,
  getE2EEmail,
  getRowsByPrefix,
  getUserByEmail,
  hasSupabaseAdminEnv,
} from "./support/db";
import { dismissRulesModal } from "./support/rules";

test.describe("tasker RBAC", () => {
  test.skip(!hasStorageState("tasker"), "Missing e2e/.auth/tasker.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("tasker") });

  test("keeps taskers out of admin and reviewer routes", async ({ page }) => {
    await page.goto("/admin");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();

    await page.goto("/review/queue");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();

    await page.goto("/admin/payouts/export");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();
  });
});

test.describe("reviewer RBAC", () => {
  test.skip(!hasStorageState("reviewer"), "Missing e2e/.auth/reviewer.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("reviewer") });

  test("keeps reviewers out of admin and tasker routes", async ({ page }) => {
    await page.goto("/admin");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/review\/queue/);
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();

    await page.goto("/");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/review\/queue/);
    await expect(page.getByRole("heading", { name: "Review Queue" })).toBeVisible();
  });
});

test.describe("admin game mode", () => {
  test.skip(!hasStorageState("admin"), "Missing e2e/.auth/admin.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("admin") });

  test("lets admins enter and exit tasker game mode", async ({ page }) => {
    await page.goto("/admin/game-mode");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Admin Game Mode" })).toBeVisible();

    await page.getByRole("button", { name: "Enter My Game Profile" }).click();
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Game mode")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();

    await page.getByRole("button", { name: "Exit Game Mode" }).click();
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Program Operations" })).toBeVisible();
  });

  test("lets admins impersonate a tasker for game actions", async ({ page }, testInfo) => {
    test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e seed/cleanup.");
    test.skip(!getE2EEmail("tasker"), "Missing E2E_TASKER_EMAIL.");

    const prefix = `e2e-impersonate-${testInfo.workerIndex}-${Date.now()}`;
    const tasker = await getUserByEmail(getE2EEmail("tasker")!);
    const taskerName = tasker.display_name ?? tasker.email ?? "Tasker";
    await cleanupByPrefix(prefix);

    await page.goto("/admin/game-mode");
    await dismissRulesModal(page);
    await page.getByLabel("Tasker").selectOption(tasker.id);
    await page.getByRole("button", { name: "Enter as Selected Tasker" }).click();
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(`Impersonating as ${taskerName}`)).toBeVisible();

    await page.getByLabel("Problem ID").fill(`${prefix}-row`);
    await page.getByRole("combobox", { name: "Task type" }).click();
    await page.getByRole("option", { name: "Debugging" }).click();
    await page.getByLabel("Token count").fill("9876");
    await page.getByLabel("Taiga problem link").fill(`https://taiga.example.com/project/live-compare/us/${prefix}`);
    await page.getByRole("button", { name: "Record submitted row" }).click();

    await expect.poll(async () => (await getRowsByPrefix(prefix)).map((row) => row.tasker_id)).toEqual([tasker.id]);

    await page.getByRole("button", { name: "Exit Game Mode" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await cleanupByPrefix(prefix);
  });
});
