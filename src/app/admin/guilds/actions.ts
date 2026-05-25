"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase";
import { computeBalancedGuildAssignments } from "./assignment";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function getAdminSupabase() {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

function revalidateGuildSurfaces() {
  revalidatePath("/admin/guilds");
  revalidatePath("/guild");
}

export async function createGuild(formData: FormData) {
  const supabase = await getAdminSupabase();
  const name = formString(formData, "name");

  if (!name) {
    throw new Error("Guild name is required.");
  }

  const { error } = await supabase.from("guilds").insert({ name });

  if (error) {
    throw new Error(error.message);
  }

  revalidateGuildSurfaces();
}

export async function renameGuild(guildId: string, formData: FormData) {
  const supabase = await getAdminSupabase();
  const name = formString(formData, "name");

  if (!name) {
    throw new Error("Guild name is required.");
  }

  const { error } = await supabase.from("guilds").update({ name }).eq("id", guildId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateGuildSurfaces();
}

export async function deleteGuild(guildId: string) {
  const supabase = await getAdminSupabase();
  const { error } = await supabase.from("guilds").delete().eq("id", guildId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateGuildSurfaces();
}

export async function assignGuildMember(formData: FormData) {
  const supabase = await getAdminSupabase();
  const guildId = formString(formData, "guildId");
  const userId = formString(formData, "userId");

  if (!guildId || !userId) {
    throw new Error("Choose a guild and tasker.");
  }

  const { error: deleteError } = await supabase.from("guild_memberships").delete().eq("user_id", userId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: insertError } = await supabase.from("guild_memberships").insert({
    guild_id: guildId,
    user_id: userId,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  revalidateGuildSurfaces();
}

export async function autoAssignGuildMembers() {
  const supabase = await getAdminSupabase();
  const [{ data: guilds, error: guildsError }, { data: memberships, error: membershipsError }, { data: taskers, error: taskersError }] =
    await Promise.all([
      supabase.from("guilds").select("id").order("name"),
      supabase.from("guild_memberships").select("user_id, guild_id"),
      supabase.from("users").select("id").eq("role", "tasker").order("display_name"),
    ]);

  const lookupError = guildsError ?? membershipsError ?? taskersError;

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const assignments = computeBalancedGuildAssignments({
    guilds: (guilds ?? []) as { id: string }[],
    memberships: (memberships ?? []) as { user_id: string; guild_id: string }[],
    taskers: (taskers ?? []) as { id: string }[],
  });

  if (assignments.length) {
    const { error } = await supabase.from("guild_memberships").insert(assignments);

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidateGuildSurfaces();
}

export async function removeGuildMember(userId: string, guildId: string) {
  const supabase = await getAdminSupabase();
  const { error } = await supabase.from("guild_memberships").delete().eq("user_id", userId).eq("guild_id", guildId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateGuildSurfaces();
}
