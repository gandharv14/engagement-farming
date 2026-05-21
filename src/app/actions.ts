"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { getMyUserRow } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function submitRow(formData: FormData) {
  const user = await requireRole("tasker");
  const supabase = await createSupabaseServerClient();
  const userRow = await getMyUserRow(user.sub);

  if (!supabase || !userRow) {
    throw new Error("Supabase is not configured.");
  }

  const tokenCount = Number(formString(formData, "tokenCount") || "0");
  const taskType = formString(formData, "taskType") || "long-horizon";

  const { error } = await supabase.from("rows").insert({
    tasker_id: userRow.id,
    status: "pending_review",
    metadata: {
      token_count: Number.isFinite(tokenCount) ? tokenCount : 0,
      task_type: taskType,
      external_row_id: formString(formData, "externalRowId") || null,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function reviewRow(rowId: string, formData: FormData) {
  await requireRole("reviewer");
  const supabase = await createSupabaseServerClient();
  const status = formString(formData, "status");
  const score = Number(formString(formData, "score"));

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  if (!["accepted_clean", "accepted_with_edits", "rejected"].includes(status)) {
    throw new Error("Invalid review status.");
  }

  const { data: reviewer } = await supabase.from("users").select("id").maybeSingle();

  if (!reviewer?.id) {
    throw new Error("Reviewer user row not found.");
  }

  const { error: rowError } = await supabase
    .from("rows")
    .update({
      status,
      reviewer_id: reviewer.id,
      reviewed_at: new Date().toISOString(),
      review_score: Number.isFinite(score) ? score : null,
    })
    .eq("id", rowId);

  if (rowError) {
    throw new Error(rowError.message);
  }

  const notes = formString(formData, "notes");

  if (notes) {
    await supabase.from("row_reviews").upsert({
      row_id: rowId,
      reviewer_id: reviewer.id,
      notes,
    });
  }

  revalidatePath("/review/queue");
  redirect("/review/queue");
}

export async function selectGoodie(achievementId: string, goodieId: string) {
  await requireRole("tasker");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase
    .from("milestone_achievements")
    .update({ goodie_id: goodieId })
    .eq("id", achievementId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/goodies");
}

export async function updateSprintConfig(formData: FormData) {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase
    .from("sprint_config")
    .update({
      current_phase: formString(formData, "currentPhase"),
      quality_multiplier: Number(formString(formData, "qualityMultiplier") || "1"),
      endgame_bounty_active: formData.get("endgameBountyActive") === "on",
      endgame_bounty_amount_cents: Number(formString(formData, "endgameBountyAmountCents") || "0"),
    })
    .eq("id", 1);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/config");
}

export async function updateEconomics(formData: FormData) {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase.from("program_economics").upsert({
    id: 1,
    budget_cents: Number(formString(formData, "budgetCents") || "0"),
    revenue_cents: Number(formString(formData, "revenueCents") || "0"),
    notes: formString(formData, "notes"),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/economics");
}
