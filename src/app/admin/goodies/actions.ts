"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";

const tierLabels = ["Tier 1", "Tier 2", "Tier 3"] as const;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formNumber(formData: FormData, key: string) {
  const value = Number(formString(formData, key) || "0");
  return Number.isFinite(value) ? value : 0;
}

function requireTierLabel(value: string) {
  if (!tierLabels.includes(value as (typeof tierLabels)[number])) {
    throw new Error("Choose a valid tier.");
  }

  return value;
}

async function getAdminSupabase() {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function revalidateGoodieSurfaces() {
  revalidatePath("/admin/goodies");
  revalidatePath("/admin/economics");
  revalidatePath("/goodies");
}

function goodiePayload(formData: FormData) {
  const name = formString(formData, "name");

  if (!name) {
    throw new Error("Goodie name is required.");
  }

  return {
    tier_label: requireTierLabel(formString(formData, "tierLabel")),
    name,
    description: formString(formData, "description") || null,
    image_url: formString(formData, "imageUrl") || null,
    available: formData.get("available") === "on",
  };
}

function internalPayload(goodieId: string, formData: FormData) {
  return {
    goodie_id: goodieId,
    unit_cost_cents: Math.max(0, Math.round(formNumber(formData, "unitCostCents"))),
    vendor: formString(formData, "vendor") || null,
    notes: formString(formData, "internalNotes") || null,
  };
}

export async function createGoodie(formData: FormData) {
  const supabase = await getAdminSupabase();
  const { data, error } = await supabase.from("goodies").insert(goodiePayload(formData)).select("id").single();

  if (error) {
    throw new Error(error.message);
  }

  const goodieId = (data as { id: string }).id;
  const { error: internalError } = await supabase.from("goodies_internal").insert(internalPayload(goodieId, formData));

  if (internalError) {
    throw new Error(internalError.message);
  }

  revalidateGoodieSurfaces();
}

export async function updateGoodie(goodieId: string, formData: FormData) {
  const supabase = await getAdminSupabase();
  const { error } = await supabase.from("goodies").update(goodiePayload(formData)).eq("id", goodieId);

  if (error) {
    throw new Error(error.message);
  }

  const { error: internalError } = await supabase.from("goodies_internal").upsert(internalPayload(goodieId, formData));

  if (internalError) {
    throw new Error(internalError.message);
  }

  revalidateGoodieSurfaces();
}

export async function archiveGoodie(goodieId: string) {
  const supabase = await getAdminSupabase();
  const { error } = await supabase.from("goodies").update({ available: false }).eq("id", goodieId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateGoodieSurfaces();
}

export async function restoreGoodie(goodieId: string) {
  const supabase = await getAdminSupabase();
  const { error } = await supabase.from("goodies").update({ available: true }).eq("id", goodieId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateGoodieSurfaces();
}

export async function markGoodieFulfilled(achievementId: string) {
  const supabase = await getAdminSupabase();
  const { error } = await supabase
    .from("milestone_achievements")
    .update({ fulfilled_at: new Date().toISOString() })
    .eq("id", achievementId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateGoodieSurfaces();
}

export async function clearGoodieFulfillment(achievementId: string) {
  const supabase = await getAdminSupabase();
  const { error } = await supabase.from("milestone_achievements").update({ fulfilled_at: null }).eq("id", achievementId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateGoodieSurfaces();
}
