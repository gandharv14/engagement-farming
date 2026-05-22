import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import { dismissRulesModal } from "./support/rules";

test.describe("tasker RBAC", () => {
  test.skip(!hasStorageState("tasker"), "Missing e2e/.auth/tasker.json. See docs/e2e-testing.md.");
  test.use({ storageState: storageStatePath("tasker") });

  test("keeps taskers out of admin and reviewer routes", async ({ page }) => {
    await page.goto("/admin");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak warm." })).toBeVisible();

    await page.goto("/review/queue");
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Keep your streak warm." })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Keep your streak warm." })).toBeVisible();

    await page.getByRole("button", { name: "Exit Game Mode" }).click();
    await dismissRulesModal(page);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Program Operations" })).toBeVisible();
  });
});
