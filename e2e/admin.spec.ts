import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import { cleanupByPrefix, getE2EEmail, getUserByEmail, hasSupabaseAdminEnv } from "./support/db";
import { dismissRulesModal } from "./support/rules";

test.describe("admin Guilds", () => {
  test.skip(!hasStorageState("admin"), "Missing e2e/.auth/admin.json. See docs/e2e-testing.md.");
  test.skip(!hasStorageState("tasker"), "Missing e2e/.auth/tasker.json. See docs/e2e-testing.md.");
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e cleanup.");
  test.skip(!getE2EEmail("tasker"), "Missing E2E_TASKER_EMAIL.");
  test.use({ storageState: storageStatePath("admin") });

  test("creates, renames, assigns, removes, and deletes a guild", async ({ page, browser }, testInfo) => {
    const prefix = `e2e-guild-${testInfo.workerIndex}-${Date.now()}`;
    const guildName = `${prefix} Alpha`;
    const renamedGuildName = `${prefix} Beta`;
    const tasker = await getUserByEmail(getE2EEmail("tasker")!);
    const taskerName = tasker.display_name ?? tasker.email ?? "Tasker";

    await cleanupByPrefix(prefix);

    await page.goto("/admin/guilds");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Guilds" })).toBeVisible();

    await page.getByLabel("Guild name").fill(guildName);
    await page.getByRole("button", { name: "Create guild" }).click();
    await expect(page.getByLabel(`Name for ${guildName}`)).toBeVisible();

    await page.getByLabel(`Name for ${guildName}`).fill(renamedGuildName);
    await page.getByRole("button", { name: `Save ${guildName}` }).click();
    await expect(page.getByLabel(`Name for ${renamedGuildName}`)).toBeVisible();

    await page.getByLabel("Tasker").selectOption(tasker.id);
    await page.getByLabel("Guild").selectOption({ label: renamedGuildName });
    await page.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByText(taskerName)).toBeVisible();

    const taskerContext = await browser.newContext({ storageState: storageStatePath("tasker") });
    const taskerPage = await taskerContext.newPage();
    await taskerPage.goto("/guild");
    await dismissRulesModal(taskerPage);
    await expect(taskerPage.getByRole("heading", { name: "Guild Room" })).toBeVisible();
    await expect(taskerPage.getByText(renamedGuildName)).toBeVisible();
    await taskerContext.close();

    await page.getByRole("button", { name: `Remove ${taskerName} from ${renamedGuildName}` }).click();
    await expect(page.getByRole("button", { name: `Remove ${taskerName} from ${renamedGuildName}` })).toHaveCount(0);

    await page.getByRole("button", { name: `Delete ${renamedGuildName}` }).click();
    await expect(page.getByLabel(`Name for ${renamedGuildName}`)).toHaveCount(0);

    await cleanupByPrefix(prefix);
  });
});

test.describe("admin Goodies", () => {
  test.skip(!hasStorageState("admin"), "Missing e2e/.auth/admin.json. See docs/e2e-testing.md.");
  test.skip(!hasStorageState("tasker"), "Missing e2e/.auth/tasker.json. See docs/e2e-testing.md.");
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e cleanup.");
  test.use({ storageState: storageStatePath("admin") });

  test("creates, edits, archives, restores, and controls tasker catalog visibility", async ({ page, browser }, testInfo) => {
    const prefix = `e2e-goodie-${testInfo.workerIndex}-${Date.now()}`;
    const goodieName = `${prefix} Sticker Pack`;
    const renamedGoodieName = `${prefix} Hoodie`;

    await cleanupByPrefix(prefix);

    await page.goto("/admin/goodies");
    await dismissRulesModal(page);
    await expect(page.getByRole("heading", { name: "Goodies" })).toBeVisible();

    await page.locator("#new-tier").selectOption("Tier 1");
    await page.locator("#new-name").fill(goodieName);
    await page.locator("#new-unit-cost").fill("25");
    await page.locator("#new-description").fill("Created from Playwright");
    await page.getByRole("button", { name: "Create goodie" }).click();
    const goodieForm = page.locator("form").filter({ has: page.getByRole("button", { name: `Save ${goodieName}` }) });
    const goodieNameInput = goodieForm.locator('input[name="name"]');
    await expect(goodieNameInput).toHaveValue(goodieName);

    const taskerContext = await browser.newContext({ storageState: storageStatePath("tasker") });
    const taskerPage = await taskerContext.newPage();
    await taskerPage.goto("/goodies");
    await dismissRulesModal(taskerPage);
    await expect(taskerPage.getByText(goodieName)).toBeVisible();

    await goodieNameInput.fill(renamedGoodieName);
    await page.getByRole("button", { name: `Save ${goodieName}` }).click();
    const renamedGoodieForm = page.locator("form").filter({ has: page.getByRole("button", { name: `Save ${renamedGoodieName}` }) });
    await expect(renamedGoodieForm.locator('input[name="name"]')).toHaveValue(renamedGoodieName);
    await taskerPage.reload();
    await expect(taskerPage.getByText(renamedGoodieName)).toBeVisible();

    await page.getByRole("button", { name: `Archive ${renamedGoodieName}` }).click();
    await expect(page.getByText("Archived")).toBeVisible();
    await taskerPage.reload();
    await expect(taskerPage.getByText(renamedGoodieName)).toHaveCount(0);

    await page.getByRole("button", { name: `Restore ${renamedGoodieName}` }).click();
    await expect(page.getByRole("button", { name: `Archive ${renamedGoodieName}` })).toBeVisible();
    await taskerPage.reload();
    await expect(taskerPage.getByText(renamedGoodieName)).toBeVisible();
    await taskerContext.close();

    await cleanupByPrefix(prefix);
  });
});
