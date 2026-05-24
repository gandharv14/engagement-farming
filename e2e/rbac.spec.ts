import { expect, test, type Page } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import {
  cleanupByPrefix,
  createE2EUser,
  ensureE2EBypassUser,
  getE2EEmail,
  getRowsByPrefix,
  getUserByEmail,
  hasSupabaseAdminEnv,
  seedPendingRowForUserId,
} from "./support/db";
import { dismissRulesModal } from "./support/rules";

const adminOnlyNavLabels = ["Operations", "Admin Mode", "Reviewers", "Taskers", "Config", "Economics", "Goodies", "Guilds", "Payouts"];

async function expectNoAdminSidebarLinks(page: Page, options: { skipLabels?: string[] } = {}) {
  await expect(page.locator('aside nav a[href^="/admin"]')).toHaveCount(0);

  const skipLabels = new Set(options.skipLabels ?? []);
  for (const label of adminOnlyNavLabels) {
    if (!skipLabels.has(label)) {
      await expect(page.getByRole("link", { name: label, exact: true })).toHaveCount(0);
    }
  }
}

test.describe("tasker RBAC", () => {
  test.skip(!hasStorageState("tasker"), "Missing e2e/.auth/tasker.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("tasker") });

  test("keeps taskers out of admin and reviewer routes", async ({ page }) => {
    await page.goto("/admin");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();
    await expectNoAdminSidebarLinks(page, { skipLabels: ["Goodies"] });

    await page.goto("/review/queue");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();
    await expectNoAdminSidebarLinks(page, { skipLabels: ["Goodies"] });

    await page.goto("/admin/payouts/export");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();
    await expectNoAdminSidebarLinks(page, { skipLabels: ["Goodies"] });
  });
});

test.describe("reviewer RBAC", () => {
  test.skip(!hasStorageState("reviewer"), "Missing e2e/.auth/reviewer.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("reviewer") });

  test("keeps reviewers out of admin and tasker routes", async ({ page }) => {
    await page.goto("/admin");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/review\/queue/);
    await expect(page.getByRole("heading", { name: "Reviewer Dashboard" })).toBeVisible();
    await expectNoAdminSidebarLinks(page);

    await page.goto("/");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/review\/queue/);
    await expect(page.getByRole("heading", { name: "Reviewer Dashboard" })).toBeVisible();
    await expectNoAdminSidebarLinks(page);
  });
});

test.describe("admin game mode", () => {
  test.skip(!hasStorageState("admin"), "Missing e2e/.auth/admin.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("admin") });

  test("lets admins enter and exit tasker game mode", async ({ page }) => {
    await page.goto("/admin/game-mode");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Admin Mode" })).toBeVisible();

    await page.getByRole("button", { name: "Enter My Game Profile" }).click();
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText("Game mode")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keep your streak online." })).toBeVisible();
    await expectNoAdminSidebarLinks(page, { skipLabels: ["Goodies"] });

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
    await expectNoAdminSidebarLinks(page, { skipLabels: ["Goodies"] });

    await page.getByLabel("Problem ID").fill(`${prefix}-row`);
    await page.getByRole("combobox", { name: "Task type" }).click();
    await page.getByRole("option", { name: "Debugging" }).click();
    await page.getByLabel("Token count").fill("9876");
    await page.getByLabel("Taiga problem link").fill(`https://taiga.example.com/project/live-compare/us/${prefix}`);
    await page.getByRole("button", { name: "Submit Sprint Entry" }).click();

    await expect.poll(async () => (await getRowsByPrefix(prefix)).map((row) => row.tasker_id)).toEqual([tasker.id]);

    await page.getByRole("button", { name: "Exit Game Mode" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await cleanupByPrefix(prefix);
  });
});

test.describe("admin reviewer impersonation e2e bypass", () => {
  test.use({ extraHTTPHeaders: { "x-e2e-role": "admin" } });

  test("lets admins impersonate a reviewer and see pending review work", async ({ page }, testInfo) => {
    test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e seed/cleanup.");

    const prefix = `e2e-reviewer-impersonate-${testInfo.workerIndex}-${Date.now()}`;
    await cleanupByPrefix(prefix);

    const [, tasker, reviewer] = await Promise.all([
      ensureE2EBypassUser("admin"),
      createE2EUser(`${prefix}-tasker`, "tasker"),
      createE2EUser(`${prefix}-reviewer`, "reviewer"),
    ]);
    const reviewerName = reviewer.display_name ?? reviewer.email ?? "Reviewer";
    await seedPendingRowForUserId(tasker.id, prefix);

    await page.goto("/admin/game-mode");
    await dismissRulesModal(page);
    await page.getByLabel("Reviewer").selectOption(reviewer.id);
    await page.getByRole("button", { name: "Enter as Selected Reviewer" }).click();
    await dismissRulesModal(page);

    await expect(page).toHaveURL(/\/review\/queue/);
    await expect(page.getByText(`Impersonating as ${reviewerName}`)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reviewer Dashboard" })).toBeVisible();
    const queuedRow = page.getByRole("row", { name: new RegExp(`${prefix}-pending.*Debugging.*4,242`) });
    await expect(queuedRow).toBeVisible();
    await expectNoAdminSidebarLinks(page);
    await queuedRow.getByRole("button", { name: "Reserve" }).click();

    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Review Row" })).toBeVisible();
    await page.getByLabel("Optional notes").fill("E2E admin reviewer impersonation pass");
    await page.getByRole("button", { name: "Pass" }).click();
    await expect(page).toHaveURL(/\/review\/queue/);
    await page.getByRole("tab", { name: "Reviewed" }).click();
    await expect(page.getByRole("row", { name: new RegExp(`${prefix}-pending.*Passed`) })).toBeVisible();

    await page.getByRole("button", { name: "Exit Game Mode" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await cleanupByPrefix(prefix);
  });
});
