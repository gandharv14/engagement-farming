import { expect, test } from "@playwright/test";

import { hasStorageState, storageStatePath } from "./support/auth";
import {
  cleanupByPrefix,
  createE2ESupabaseClient,
  createE2EUser,
  getE2EEmail,
  getUserByEmail,
  hasSupabaseAdminEnv,
} from "./support/db";
import { dismissRulesModal } from "./support/rules";

async function getUnassignedTaskerIds() {
  const supabase = createE2ESupabaseClient();
  const [{ data: taskers, error: taskersError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from("users").select("id").eq("role", "tasker"),
    supabase.from("guild_memberships").select("user_id"),
  ]);

  if (taskersError || membershipsError) {
    throw new Error((taskersError ?? membershipsError)?.message);
  }

  const assignedTaskerIds = new Set(((memberships ?? []) as { user_id: string }[]).map((membership) => membership.user_id));

  return ((taskers ?? []) as { id: string }[]).filter((tasker) => !assignedTaskerIds.has(tasker.id)).map((tasker) => tasker.id);
}

async function createGuildsForE2E(prefix: string) {
  const supabase = createE2ESupabaseClient();
  const { data, error } = await supabase
    .from("guilds")
    .insert([{ name: `${prefix} Alpha` }, { name: `${prefix} Beta` }, { name: `${prefix} Gamma` }])
    .select("id, name");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as { id: string; name: string }[];
}

async function getMembershipsByUserId(userIds: string[]) {
  const supabase = createE2ESupabaseClient();
  const { data, error } = await supabase.from("guild_memberships").select("user_id, guild_id").in("user_id", userIds);

  if (error) {
    throw new Error(error.message);
  }

  return new Map(((data ?? []) as { user_id: string; guild_id: string }[]).map((membership) => [membership.user_id, membership.guild_id]));
}

async function removeGuildMembershipsForUsers(userIds: string[]) {
  if (!userIds.length) {
    return;
  }

  const supabase = createE2ESupabaseClient();
  const { error } = await supabase.from("guild_memberships").delete().in("user_id", userIds);

  if (error) {
    throw new Error(error.message);
  }
}

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

test.describe("admin Guilds auto assign", () => {
  test.skip(!hasSupabaseAdminEnv(), "Missing Supabase service-role env for e2e database helpers.");
  test.use({ extraHTTPHeaders: { "x-e2e-role": "admin" } });

  test("assigns unassigned taskers to the smallest guilds without moving existing members", async ({ page }, testInfo) => {
    const prefix = `e2e-auto-guild-${testInfo.workerIndex}-${Date.now()}`;

    await cleanupByPrefix(prefix);
    const preExistingUnassignedTaskerIds = await getUnassignedTaskerIds();

    try {
      const [assignedTasker, taskerOne, taskerTwo, taskerThree] = await Promise.all([
        createE2EUser(`${prefix}-assigned`),
        createE2EUser(`${prefix}-one`),
        createE2EUser(`${prefix}-two`),
        createE2EUser(`${prefix}-three`),
      ]);
      const guilds = await createGuildsForE2E(prefix);
      const guildByName = new Map(guilds.map((guild) => [guild.name, guild.id]));
      const alphaGuildId = guildByName.get(`${prefix} Alpha`);
      const betaGuildId = guildByName.get(`${prefix} Beta`);
      const gammaGuildId = guildByName.get(`${prefix} Gamma`);

      if (!alphaGuildId || !betaGuildId || !gammaGuildId) {
        throw new Error("Expected all e2e guilds to be created.");
      }

      const supabase = createE2ESupabaseClient();
      const { error: membershipError } = await supabase.from("guild_memberships").insert({
        guild_id: alphaGuildId,
        user_id: assignedTasker.id,
      });

      if (membershipError) {
        throw new Error(membershipError.message);
      }

      await page.goto("/admin/guilds");
      await dismissRulesModal(page);
      await expect(page.getByRole("heading", { name: "Guilds" })).toBeVisible();
      await expect(page.getByText(`${preExistingUnassignedTaskerIds.length + 3} unassigned taskers ready to place.`)).toBeVisible();

      await page.getByRole("button", { name: "Auto assign unassigned taskers" }).click();
      await expect(page.getByText("All taskers are assigned to a guild.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Auto assign unassigned taskers" })).toBeDisabled();

      const memberships = await getMembershipsByUserId([assignedTasker.id, taskerOne.id, taskerTwo.id, taskerThree.id]);

      expect(memberships.get(assignedTasker.id)).toBe(alphaGuildId);
      expect(memberships.get(taskerOne.id)).toBeTruthy();
      expect(memberships.get(taskerTwo.id)).toBeTruthy();
      expect(memberships.get(taskerThree.id)).toBeTruthy();
    } finally {
      await removeGuildMembershipsForUsers(preExistingUnassignedTaskerIds);
      await cleanupByPrefix(prefix);
    }
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
