"use server";

import { revalidatePath } from "next/cache";

import { clearAdminGameModeCookie, getAdminGameModeTarget } from "@/lib/admin-game-mode";
import { requireRole } from "@/lib/auth";
import type { AppRole } from "@/lib/roles";
import { createSupabaseServerClient } from "@/lib/supabase";

type RoleChange = {
  from: Extract<AppRole, "tasker" | "reviewer">;
  to: Extract<AppRole, "tasker" | "reviewer">;
};

async function getAdminSupabase() {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function revalidateRoleSurfaces() {
  revalidatePath("/admin/taskers");
  revalidatePath("/admin/reviewers");
  revalidatePath("/admin/game-mode");
}

function revalidateTaskerRemovalSurfaces() {
  revalidateRoleSurfaces();
  revalidatePath("/admin/guilds");
  revalidatePath("/admin/payouts");
  revalidatePath("/review/queue");
  revalidatePath("/leaderboards");
  revalidatePath("/");
}

async function clearChangedImpersonationTarget(userId: string, role: RoleChange["from"]) {
  const target = await getAdminGameModeTarget();

  if (role === "tasker" && target?.mode === "tasker" && target.taskerId === userId) {
    await clearAdminGameModeCookie();
  }

  if (role === "reviewer" && target?.mode === "reviewer" && target.reviewerId === userId) {
    await clearAdminGameModeCookie();
  }
}

async function updateUserRole(userId: string, change: RoleChange) {
  const supabase = await getAdminSupabase();
  const { data: user, error: lookupError } = await supabase
    .from("users")
    .select("id, auth0_sub, role")
    .eq("id", userId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const currentUser = user as { id: string; auth0_sub: string; role: AppRole } | null;

  if (!currentUser || currentUser.role !== change.from) {
    throw new Error(`Choose a valid ${change.from}.`);
  }

  if (change.from === "tasker" && currentUser.auth0_sub.startsWith("admin-game|")) {
    throw new Error("Admin game profiles cannot be promoted to reviewers.");
  }

  const { error } = await supabase.from("users").update({ role: change.to }).eq("id", currentUser.id);

  if (error) {
    throw new Error(error.message);
  }

  await clearChangedImpersonationTarget(currentUser.id, change.from);
  revalidateRoleSurfaces();
}

export async function promoteTaskerToReviewer(userId: string) {
  await updateUserRole(userId, { from: "tasker", to: "reviewer" });
}

export async function demoteReviewerToTasker(userId: string) {
  await updateUserRole(userId, { from: "reviewer", to: "tasker" });
}

export async function removeTasker(userId: string) {
  const supabase = await getAdminSupabase();
  const { data: user, error: lookupError } = await supabase
    .from("users")
    .select("id, auth0_sub, email, display_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const currentUser = user as
    | { id: string; auth0_sub: string; email: string | null; display_name: string | null; role: AppRole }
    | null;

  if (!currentUser || currentUser.role !== "tasker") {
    throw new Error("Choose a valid tasker.");
  }

  if (currentUser.auth0_sub.startsWith("admin-game|")) {
    throw new Error("Admin game profiles cannot be removed from the tasker roster.");
  }

  const { error: reviewDeleteError } = await supabase.from("row_reviews").delete().eq("reviewer_id", currentUser.id);

  if (reviewDeleteError) {
    throw new Error(reviewDeleteError.message);
  }

  const { error: tombstoneError } = await supabase.from("removed_users").upsert(
    {
      auth0_sub: currentUser.auth0_sub,
      email: currentUser.email,
      display_name: currentUser.display_name,
      role: currentUser.role,
      removed_at: new Date().toISOString(),
    },
    { onConflict: "auth0_sub" },
  );
  const tombstoneCreated = !tombstoneError;

  if (tombstoneError && !isMissingRemovedUsersTable(tombstoneError)) {
    throw new Error(tombstoneError.message);
  }

  const { error: deleteError } = await supabase.from("users").delete().eq("id", currentUser.id);

  if (deleteError) {
    if (tombstoneCreated) {
      await supabase.from("removed_users").delete().eq("auth0_sub", currentUser.auth0_sub);
    }

    throw new Error(deleteError.message);
  }

  await clearChangedImpersonationTarget(currentUser.id, "tasker");
  revalidateTaskerRemovalSurfaces();
}

function isMissingRemovedUsersTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("removed_users") && error.message.includes("schema cache"))
  );
}
