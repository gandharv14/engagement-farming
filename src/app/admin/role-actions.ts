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
