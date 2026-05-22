import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

let envLoaded = false;

type AppRole = "admin" | "reviewer" | "tasker";

export type E2EUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
};

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadE2EEnv() {
  if (envLoaded) {
    return;
  }

  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env.test"));
  envLoaded = true;
}

export function getE2EEmail(role: AppRole) {
  loadE2EEnv();
  return process.env[`E2E_${role.toUpperCase()}_EMAIL`];
}

export function hasSupabaseAdminEnv() {
  loadE2EEnv();
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createE2ESupabaseClient() {
  loadE2EEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for e2e database helpers.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getUserByEmail(email: string): Promise<E2EUser> {
  const supabase = createE2ESupabaseClient();
  const { data, error } = await supabase.from("users").select("id, email, display_name, role").eq("email", email).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error(`No app user found for ${email}. Sign in with that account once before running data-dependent e2e tests.`);
  }

  return data as E2EUser;
}

export async function cleanupByPrefix(prefix: string) {
  const supabase = createE2ESupabaseClient();
  const { data: rows } = await supabase.from("rows").select("id").like("metadata->>external_row_id", `${prefix}%`);
  const rowIds = ((rows ?? []) as { id: string }[]).map((row) => row.id);

  if (rowIds.length) {
    await supabase.from("row_reviews").delete().in("row_id", rowIds);
    await supabase.from("earnings").delete().in("reference_id", rowIds);
    await supabase.from("rows").delete().in("id", rowIds);
  }

  await supabase.from("guilds").delete().like("name", `${prefix}%`);
  await supabase.from("goodies").delete().like("name", `${prefix}%`);
  await supabase.from("users").delete().like("auth0_sub", `e2e|${prefix}%`);
}

export async function createE2EUser(prefix: string, role: AppRole = "tasker") {
  const supabase = createE2ESupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .insert({
      auth0_sub: `e2e|${prefix}`,
      email: `${prefix}@example.com`,
      display_name: `${prefix} User`,
      role,
    })
    .select("id, auth0_sub, email, display_name, role")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as E2EUser;
}

export async function seedAcceptedRowsForTasker(taskerEmail: string, prefix: string, count: number) {
  const supabase = createE2ESupabaseClient();
  const tasker = await getUserByEmail(taskerEmail);
  const rows = Array.from({ length: count }, (_, index) => ({
    tasker_id: tasker.id,
    status: "pending_review",
    metadata: {
      external_row_id: `${prefix}-accepted-${index + 1}`,
      task_type: "e2e",
      token_count: 1000 + index,
    },
  }));
  const { data, error } = await supabase.from("rows").insert(rows).select("id");

  if (error) {
    throw new Error(error.message);
  }

  const rowIds = ((data ?? []) as { id: string }[]).map((row) => row.id);
  const { error: updateError } = await supabase
    .from("rows")
    .update({ status: "accepted_clean", reviewed_at: new Date().toISOString(), review_score: 5 })
    .in("id", rowIds);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function seedPendingRowForTasker(taskerEmail: string, prefix: string) {
  const supabase = createE2ESupabaseClient();
  const tasker = await getUserByEmail(taskerEmail);
  const { data, error } = await supabase
    .from("rows")
    .insert({
      tasker_id: tasker.id,
      status: "pending_review",
      metadata: {
        external_row_id: `${prefix}-pending`,
        task_type: "e2e",
        token_count: 4242,
      },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string }).id;
}

export async function getRowsByPrefix(prefix: string) {
  const supabase = createE2ESupabaseClient();
  const { data, error } = await supabase
    .from("rows")
    .select("id, tasker_id, status, metadata")
    .like("metadata->>external_row_id", `${prefix}%`);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as { id: string; tasker_id: string; status: string; metadata: Record<string, unknown> }[];
}

export async function getRowReview(rowId: string) {
  const supabase = createE2ESupabaseClient();
  const { data, error } = await supabase.from("row_reviews").select("row_id, reviewer_id, notes").eq("row_id", rowId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { row_id: string; reviewer_id: string; notes: string | null } | null;
}

export async function getRowStatus(rowId: string) {
  const supabase = createE2ESupabaseClient();
  const { data, error } = await supabase.from("rows").select("status, review_score, reviewed_at").eq("id", rowId).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as { status: string; review_score: number | null; reviewed_at: string | null } | null;
}

export async function seedPayoutEarningForUser(userEmail: string, referenceId: string, amountCents: number) {
  const user = await getUserByEmail(userEmail);
  await seedPayoutEarning(user.id, referenceId, amountCents);

  return user;
}

export async function seedPayoutEarning(userId: string, referenceId: string, amountCents: number) {
  const supabase = createE2ESupabaseClient();
  const { error } = await supabase.from("earnings").insert({
    user_id: userId,
    source: "quality_bonus",
    amount_cents: amountCents,
    reference_id: referenceId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function cleanupEarningByReferenceId(referenceId: string) {
  const supabase = createE2ESupabaseClient();
  const { error } = await supabase.from("earnings").delete().eq("reference_id", referenceId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createGoodieForE2E(prefix: string, tierLabel = "Tier 1") {
  const supabase = createE2ESupabaseClient();
  const name = `${prefix} Goodie`;
  const { data, error } = await supabase
    .from("goodies")
    .insert({
      tier_label: tierLabel,
      name,
      description: "E2E reward",
      available: true,
    })
    .select("id, name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const goodie = data as { id: string; name: string };
  const { error: internalError } = await supabase.from("goodies_internal").insert({
    goodie_id: goodie.id,
    unit_cost_cents: 1234,
    vendor: "E2E vendor",
    notes: "Created by Playwright",
  });

  if (internalError) {
    throw new Error(internalError.message);
  }

  return goodie;
}
