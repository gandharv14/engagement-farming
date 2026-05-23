import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireRole, type AppSessionUser } from "@/lib/auth";
import { type AppUserRow, getMyUserRow } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase";

const adminGameModeCookie = "admin-game-mode";
const ownGameModeValue = "own";
const taskerImpersonatePrefix = "tasker:";
const reviewerImpersonatePrefix = "reviewer:";

export type AdminGameModeTarget =
  | { mode: "own" }
  | {
      mode: "tasker";
      taskerId: string;
    }
  | {
      mode: "reviewer";
      reviewerId: string;
    };

export type TaskerGameContext = {
  sessionUser: AppSessionUser;
  tasker: AppUserRow;
  isAdminGameMode: boolean;
  gameModeLabel: string | null;
};

export type ReviewerGameContext = {
  sessionUser: AppSessionUser;
  reviewer: AppUserRow;
  isAdminGameMode: boolean;
  gameModeLabel: string | null;
};

export type AdminGameModeStatus =
  | {
      mode: "own" | "tasker";
      role: "tasker";
      target: AppUserRow;
    }
  | {
      mode: "reviewer";
      role: "reviewer";
      target: AppUserRow;
    };

export type TaskerOption = {
  id: string;
  auth0_sub: string;
  display_name: string | null;
  email: string | null;
};

export function getAppUserDisplayName(user: Pick<AppUserRow, "display_name" | "email">, fallback = "Tasker") {
  return user.display_name ?? user.email ?? fallback;
}

export function getTaskerShellProps(context: TaskerGameContext) {
  return {
    role: context.sessionUser.role,
    name: context.sessionUser.name ?? context.sessionUser.email ?? getAppUserDisplayName(context.tasker),
    navigationRole: "tasker" as const,
    gameMode: context.isAdminGameMode
      ? {
          label: context.gameModeLabel ?? "Playing",
          targetName: getAppUserDisplayName(context.tasker),
        }
      : undefined,
  };
}

export function getReviewerShellProps(context: ReviewerGameContext) {
  return {
    role: context.sessionUser.role,
    name: context.sessionUser.name ?? context.sessionUser.email ?? getAppUserDisplayName(context.reviewer, "Reviewer"),
    navigationRole: "reviewer" as const,
    gameMode: context.isAdminGameMode
      ? {
          label: context.gameModeLabel ?? "Reviewing",
          targetName: getAppUserDisplayName(context.reviewer, "Reviewer"),
        }
      : undefined,
  };
}

const cookieOptions = {
  httpOnly: true,
  maxAge: 60 * 60 * 8,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function requireTaskerGameContext(): Promise<TaskerGameContext> {
  const sessionUser = await requireRole(["tasker", "admin"]);

  if (sessionUser.role === "tasker") {
    const tasker = await getMyUserRow(sessionUser.sub);

    if (!tasker) {
      redirect("/login");
    }

    return {
      sessionUser,
      tasker,
      isAdminGameMode: false,
      gameModeLabel: null,
    };
  }

  const admin = await getMyUserRow(sessionUser.sub);

  if (!admin) {
    redirect("/admin");
  }

  const status = await getAdminGameModeStatus(admin);

  if (!status || status.role !== "tasker") {
    redirect("/admin");
  }

  return {
    sessionUser,
    tasker: status.target,
    isAdminGameMode: true,
    gameModeLabel: status.mode === "own" ? "Playing" : "Impersonating",
  };
}

export async function requireReviewerGameContext(): Promise<ReviewerGameContext> {
  const sessionUser = await requireRole(["reviewer", "admin"]);

  if (sessionUser.role === "reviewer") {
    const reviewer = await getMyUserRow(sessionUser.sub);

    if (!reviewer) {
      redirect("/login");
    }

    return {
      sessionUser,
      reviewer,
      isAdminGameMode: false,
      gameModeLabel: null,
    };
  }

  const admin = await getMyUserRow(sessionUser.sub);

  if (!admin) {
    redirect("/admin");
  }

  const status = await getAdminGameModeStatus(admin);

  if (!status || status.role !== "reviewer") {
    redirect("/admin/game-mode");
  }

  return {
    sessionUser,
    reviewer: status.target,
    isAdminGameMode: true,
    gameModeLabel: "Impersonating",
  };
}

export async function getAdminGameModeStatus(admin: AppUserRow): Promise<AdminGameModeStatus | null> {
  const target = await readAdminGameModeCookie();

  if (!target) {
    return null;
  }

  if (target.mode === "own") {
    const shadowTasker = await getOrCreateAdminShadowTasker(admin);
    return shadowTasker ? { mode: "own", role: "tasker", target: shadowTasker } : null;
  }

  if (target.mode === "tasker") {
    const tasker = await getTaskerById(target.taskerId);
    return tasker ? { mode: "tasker", role: "tasker", target: tasker } : null;
  }

  const reviewer = await getReviewerById(target.reviewerId);
  return reviewer ? { mode: "reviewer", role: "reviewer", target: reviewer } : null;
}

export async function setOwnAdminGameModeCookie() {
  const cookieStore = await cookies();
  cookieStore.set(adminGameModeCookie, ownGameModeValue, cookieOptions);
}

export async function setTaskerImpersonationCookie(taskerId: string) {
  const cookieStore = await cookies();
  cookieStore.set(adminGameModeCookie, `${taskerImpersonatePrefix}${taskerId}`, cookieOptions);
}

export async function setReviewerImpersonationCookie(reviewerId: string) {
  const cookieStore = await cookies();
  cookieStore.set(adminGameModeCookie, `${reviewerImpersonatePrefix}${reviewerId}`, cookieOptions);
}

export async function clearAdminGameModeCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(adminGameModeCookie);
}

export async function getAdminGameModeTarget() {
  return readAdminGameModeCookie();
}

export async function getOrCreateAdminShadowTasker(admin: AppUserRow): Promise<AppUserRow | null> {
  const supabase = await createSupabaseServerClient();
  const auth0Sub = getShadowAuth0Sub(admin);

  if (!supabase) {
    return {
      id: "00000000-0000-0000-0000-000000000000",
      auth0_sub: auth0Sub,
      email: admin.email,
      display_name: getShadowDisplayName(admin),
      role: "tasker",
      admin_game_owner_id: admin.id,
    };
  }

  const select = "id, auth0_sub, email, display_name, role";
  const { data: existing } = await supabase
    .from("users")
    .select(select)
    .eq("auth0_sub", auth0Sub)
    .maybeSingle();

  if (existing) {
    return linkShadowTaskerToAdmin(existing as AppUserRow, admin.id);
  }

  const shadowUser = {
    auth0_sub: auth0Sub,
    email: admin.email ? toShadowEmail(admin.email) : null,
    display_name: getShadowDisplayName(admin),
    role: "tasker",
  };
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        ...shadowUser,
        admin_game_owner_id: admin.id,
      },
      { onConflict: "auth0_sub" },
    )
    .select(select)
    .single();

  if (error) {
    if (!isMissingAdminGameOwnerColumn(error)) {
      throw new Error(error.message);
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("users")
      .upsert(shadowUser, { onConflict: "auth0_sub" })
      .select(select)
      .single();

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    return fallbackData as AppUserRow;
  }

  return { ...(data as AppUserRow), admin_game_owner_id: admin.id };
}

export async function getTaskerById(taskerId: string): Promise<AppUserRow | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("users")
    .select("id, auth0_sub, email, display_name, role")
    .eq("id", taskerId)
    .eq("role", "tasker")
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

export async function getReviewerById(reviewerId: string): Promise<AppUserRow | null> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("users")
    .select("id, auth0_sub, email, display_name, role")
    .eq("id", reviewerId)
    .eq("role", "reviewer")
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

export async function getTaskerOptionsForAdmin(): Promise<TaskerOption[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("users")
    .select("id, auth0_sub, display_name, email")
    .eq("role", "tasker")
    .order("display_name", { ascending: true });

  return ((data ?? []) as TaskerOption[]).filter((tasker) => !tasker.auth0_sub.startsWith("admin-game|"));
}

export async function getReviewerOptionsForAdmin(): Promise<TaskerOption[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data } = await supabase
    .from("users")
    .select("id, auth0_sub, display_name, email")
    .eq("role", "reviewer")
    .order("display_name", { ascending: true });

  return (data ?? []) as TaskerOption[];
}

function getShadowDisplayName(admin: AppUserRow) {
  return `${getAppUserDisplayName(admin, "Admin")} (Game Mode)`;
}

export function getShadowAuth0Sub(admin: AppUserRow) {
  return `admin-game|${admin.id}`;
}

export function toShadowEmail(email: string) {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return null;
  }

  return `${localPart}+game-mode@${domain}`;
}

async function readAdminGameModeCookie(): Promise<AdminGameModeTarget | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(adminGameModeCookie)?.value;

  return parseAdminGameModeCookieValue(value);
}

export function parseAdminGameModeCookieValue(value: string | undefined): AdminGameModeTarget | null {
  if (!value) {
    return null;
  }

  if (value === ownGameModeValue) {
    return { mode: "own" };
  }

  if (value.startsWith(taskerImpersonatePrefix)) {
    const taskerId = value.slice(taskerImpersonatePrefix.length);
    return taskerId ? { mode: "tasker", taskerId } : null;
  }

  if (value.startsWith(reviewerImpersonatePrefix)) {
    const reviewerId = value.slice(reviewerImpersonatePrefix.length);
    return reviewerId ? { mode: "reviewer", reviewerId } : null;
  }

  return null;
}

async function linkShadowTaskerToAdmin(tasker: AppUserRow, adminId: string): Promise<AppUserRow> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { ...tasker, admin_game_owner_id: adminId };
  }

  const { data, error } = await supabase
    .from("users")
    .update({ admin_game_owner_id: adminId })
    .eq("id", tasker.id)
    .select("id, auth0_sub, email, display_name, role")
    .single();

  if (error) {
    if (isMissingAdminGameOwnerColumn(error)) {
      return tasker;
    }

    throw new Error(error.message);
  }

  return { ...(data as AppUserRow), admin_game_owner_id: adminId };
}

function isMissingAdminGameOwnerColumn(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.includes("admin_game_owner_id") ||
    error.message?.includes("Could not find the 'admin_game_owner_id' column")
  );
}
