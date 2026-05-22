"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTaskerGameContext } from "@/lib/admin-game-mode";
import { requireRole } from "@/lib/auth";
import { getMyUserRow } from "@/lib/data";
import {
  MAX_PROBLEMS_PER_TASKER_PER_DAY,
  formatDateOnly,
  getCollectiveProblemCapacity,
  getMaxProblemsPerTasker,
  getSprintDurationDays,
  parseDateOnly,
} from "@/lib/sprint-config";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isTaskType } from "@/lib/task-types";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function requiredFormString(formData: FormData, key: string, label: string) {
  const value = formString(formData, key).trim();

  if (!value) {
    throw new Error(`${label} is required.`);
  }

  return value;
}

function parsePositiveIntegerInput(value: string, label: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new Error(`${label} must be a whole number greater than 0.`);
  }

  return numberValue;
}

function parseNonNegativeNumberInput(value: string, label: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${label} cannot be negative.`);
  }

  return numberValue;
}

function parseNonNegativeIntegerInput(value: string, label: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < 0) {
    throw new Error(`${label} must be a whole number that is 0 or greater.`);
  }

  return numberValue;
}

function sprintConfigRedirectUrl(params: { saved?: boolean; warnings?: string[]; error?: string }) {
  const searchParams = new URLSearchParams();

  if (params.saved) {
    searchParams.set("saved", "1");
  }

  params.warnings?.forEach((warning) => {
    searchParams.append("warning", warning);
  });

  if (params.error) {
    searchParams.set("error", params.error);
  }

  const queryString = searchParams.toString();
  return queryString ? `/admin/config?${queryString}` : "/admin/config";
}

export async function submitRow(formData: FormData) {
  const context = await requireTaskerGameContext();
  const supabase = await createSupabaseServerClient();
  const userRow = context.tasker;

  if (!supabase || !userRow) {
    throw new Error("Supabase is not configured.");
  }

  const problemId = requiredFormString(formData, "problemId", "Problem ID");
  const taskType = requiredFormString(formData, "taskType", "Task type");
  const tokenCount = parseNonNegativeNumberInput(requiredFormString(formData, "tokenCount", "Token count"), "Token count");
  const taigaProblemUrl = requiredFormString(formData, "taigaProblemUrl", "Taiga problem link");
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setUTCDate(todayStart.getUTCDate() + 1);

  if (!isTaskType(taskType)) {
    throw new Error("Task type must be one of the configured options.");
  }

  let taigaUrl: URL;

  try {
    taigaUrl = new URL(taigaProblemUrl);
  } catch {
    throw new Error("Taiga problem link must be a valid URL.");
  }

  if (!["http:", "https:"].includes(taigaUrl.protocol)) {
    throw new Error("Taiga problem link must be an HTTP or HTTPS URL.");
  }

  const { count: submissionsToday, error: countError } = await supabase
    .from("rows")
    .select("id", { count: "exact", head: true })
    .eq("tasker_id", userRow.id)
    .gte("submitted_at", todayStart.toISOString())
    .lt("submitted_at", tomorrowStart.toISOString());

  if (countError) {
    throw new Error(countError.message);
  }

  if ((submissionsToday ?? 0) >= MAX_PROBLEMS_PER_TASKER_PER_DAY) {
    throw new Error(`Daily submission limit reached (${MAX_PROBLEMS_PER_TASKER_PER_DAY} problems).`);
  }

  const { error } = await supabase.from("rows").insert({
    tasker_id: userRow.id,
    status: "pending_review",
    metadata: {
      problem_id: problemId,
      task_type: taskType,
      token_count: tokenCount,
      taiga_problem_url: taigaUrl.toString(),
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}

export async function reviewRow(rowId: string, formData: FormData) {
  const user = await requireRole("reviewer");
  const supabase = await createSupabaseServerClient();
  const reviewer = await getMyUserRow(user.sub);
  const status = formString(formData, "status");
  const score = Number(formString(formData, "score"));

  if (!supabase || !reviewer) {
    throw new Error("Supabase is not configured.");
  }

  if (!["accepted_clean", "accepted_with_edits", "rejected"].includes(status)) {
    throw new Error("Invalid review status.");
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
  const context = await requireTaskerGameContext();
  const supabase = await createSupabaseServerClient();
  const userRow = context.tasker;

  if (!supabase || !userRow) {
    throw new Error("Supabase is not configured.");
  }

  const { error } = await supabase
    .from("milestone_achievements")
    .update({ goodie_id: goodieId })
    .eq("id", achievementId)
    .eq("user_id", userRow.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/goodies");
}

export async function updateSprintConfig(formData: FormData) {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect(sprintConfigRedirectUrl({ error: "Supabase is not configured." }));
  }

  let redirectUrl = "/admin/config";

  try {
    const sprintStartDate = parseDateOnly(formString(formData, "sprintStartDate"), "Sprint start date");
    const sprintEndDate = parseDateOnly(formString(formData, "sprintEndDate"), "Sprint end date");

    if (sprintEndDate < sprintStartDate) {
      throw new Error("Sprint end date cannot be before the start date.");
    }

    const sprintDurationDays = getSprintDurationDays(sprintStartDate, sprintEndDate);
    const currentPhase = formString(formData, "currentPhase");
    const qualityMultiplier = parseNonNegativeNumberInput(formString(formData, "qualityMultiplier") || "1", "Quality multiplier");
    const endgameBountyAmountCents = parseNonNegativeIntegerInput(
      formString(formData, "endgameBountyAmountCents") || "0",
      "Endgame bounty amount",
    );
    const collectiveGoalRows = parsePositiveIntegerInput(formString(formData, "collectiveGoalRows"), "Collective goal rows");
    const collectiveStretchRows = parsePositiveIntegerInput(formString(formData, "collectiveStretchRows"), "Collective stretch rows");
    const milestoneRows = [
      {
        id: 1,
        threshold_rows: parsePositiveIntegerInput(formString(formData, "tier1ThresholdRows"), "Tier 1 threshold"),
        tier_label: "Tier 1",
      },
      {
        id: 2,
        threshold_rows: parsePositiveIntegerInput(formString(formData, "tier2ThresholdRows"), "Tier 2 threshold"),
        tier_label: "Tier 2",
      },
      {
        id: 3,
        threshold_rows: parsePositiveIntegerInput(formString(formData, "tier3ThresholdRows"), "Tier 3 threshold"),
        tier_label: "Tier 3",
      },
    ];

    if (!["warmup", "steady", "finale"].includes(currentPhase)) {
      throw new Error("Current phase must be warmup, steady, or finale.");
    }

    const warnings: string[] = [];

    if (collectiveStretchRows < collectiveGoalRows) {
      throw new Error("Collective stretch rows cannot be lower than the collective goal rows.");
    }

    for (let index = 1; index < milestoneRows.length; index += 1) {
      if (milestoneRows[index].threshold_rows <= milestoneRows[index - 1].threshold_rows) {
        warnings.push("Goodie milestone thresholds do not increase from Tier 1 through Tier 3.");
      }
    }

    if (new Set(milestoneRows.map((milestone) => milestone.threshold_rows)).size !== milestoneRows.length) {
      throw new Error("Goodie milestone thresholds must be unique.");
    }

    const { count: taskerCount, error: taskerCountError } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "tasker")
      .is("admin_game_owner_id", null);

    if (taskerCountError) {
      throw new Error(taskerCountError.message);
    }

    const realTaskerCount = taskerCount ?? 0;
    const maxProblemsPerTasker = getMaxProblemsPerTasker(sprintDurationDays);
    const collectiveCapacity = getCollectiveProblemCapacity(sprintDurationDays, realTaskerCount);

    if (realTaskerCount < 1) {
      warnings.push("No real taskers are currently rostered, so any collective challenge is impossible until taskers are added.");
    }

    if (collectiveGoalRows > collectiveCapacity) {
      warnings.push(`Collective goal rows exceed the current capacity of ${collectiveCapacity} for ${realTaskerCount} taskers over ${sprintDurationDays} days.`);
    }

    if (collectiveStretchRows > collectiveCapacity) {
      warnings.push(`Collective stretch rows exceed the current capacity of ${collectiveCapacity} for ${realTaskerCount} taskers over ${sprintDurationDays} days.`);
    }

    const impossibleMilestones = milestoneRows.filter((milestone) => milestone.threshold_rows > maxProblemsPerTasker);

    impossibleMilestones.forEach((milestone) => {
      warnings.push(`${milestone.tier_label} requires ${milestone.threshold_rows} rows, but one player can complete at most ${maxProblemsPerTasker} in this sprint.`);
    });

    const { error } = await supabase.from("sprint_config").upsert({
      id: 1,
      sprint_start_date: formatDateOnly(sprintStartDate),
      sprint_end_date: formatDateOnly(sprintEndDate),
      current_phase: currentPhase,
      quality_multiplier: qualityMultiplier,
      endgame_bounty_active: formData.get("endgameBountyActive") === "on",
      endgame_bounty_amount_cents: endgameBountyAmountCents,
      collective_goal_rows: collectiveGoalRows,
      collective_stretch_rows: collectiveStretchRows,
    });

    if (error) {
      throw new Error(error.message);
    }

    const { error: milestoneError } = await supabase.from("milestones").upsert(milestoneRows);

    if (milestoneError) {
      throw new Error(milestoneError.message);
    }

    revalidatePath("/");
    revalidatePath("/goodies");
    revalidatePath("/admin/config");

    redirectUrl = sprintConfigRedirectUrl({ saved: true, warnings });
  } catch (error) {
    redirectUrl = sprintConfigRedirectUrl({
      error: error instanceof Error ? error.message : "Sprint config could not be saved.",
    });
  }

  redirect(redirectUrl);
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
