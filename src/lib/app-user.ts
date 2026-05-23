import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { AppRole, Claims, getUserRoleFromClaims, isAppRole } from "@/lib/roles";

export type AppUserRecord = {
  id: string;
  auth0_sub: string;
  email: string | null;
  display_name: string | null;
  role: AppRole;
};

const appUserSelect = "id, auth0_sub, email, display_name, role";
type SupabaseAdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

export function getDefaultAppRole(): AppRole {
  const role = process.env.DEFAULT_APP_ROLE?.toLowerCase();
  return isAppRole(role) ? role : "tasker";
}

export async function ensureAppUser(claims: Claims): Promise<AppUserRecord | null> {
  const supabase = createSupabaseAdminClient();
  const fallbackRole = getUserRoleFromClaims(claims) ?? getBootstrapRole(claims) ?? getDefaultAppRole();
  const fallbackUser = getFallbackAppUser(claims, fallbackRole);

  if (!supabase) {
    return fallbackUser;
  }

  if (await isRemovedAppUser(supabase, claims.sub)) {
    return null;
  }

  const { data: existing, error: existingError } = await supabase
    .from("users")
    .select(appUserSelect)
    .eq("auth0_sub", claims.sub)
    .maybeSingle();

  if (existingError) {
    console.error("Unable to load app user from Supabase.", existingError.message);
  }

  const role = ((existing as AppUserRecord | null)?.role ?? fallbackRole) as AppRole;

  const { data, error: upsertError } = await supabase
    .from("users")
    .upsert(
      {
        auth0_sub: claims.sub,
        email: claims.email ?? null,
        display_name: getDisplayName(claims),
        role,
      },
      { onConflict: "auth0_sub" },
    )
    .select(appUserSelect)
    .single();

  if (upsertError) {
    console.error("Unable to upsert app user in Supabase.", upsertError.message);
  }

  return (data as AppUserRecord | null) ?? ((existing as AppUserRecord | null) || fallbackUser);
}

async function isRemovedAppUser(supabase: SupabaseAdminClient, auth0Sub: string) {
  const { data, error } = await supabase
    .from("removed_users")
    .select("auth0_sub")
    .eq("auth0_sub", auth0Sub)
    .maybeSingle();

  if (error) {
    if (isMissingRemovedUsersTable(error)) {
      return false;
    }

    console.error("Unable to check removed app users.", error.message);
    return false;
  }

  return Boolean(data);
}

function isMissingRemovedUsersTable(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("removed_users") && error.message.includes("schema cache"))
  );
}

function getDisplayName(claims: Claims) {
  return claims.name ?? claims.nickname ?? claims.email ?? "Labelbox User";
}

function getFallbackAppUser(claims: Claims, role: AppRole): AppUserRecord {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    auth0_sub: claims.sub,
    email: claims.email ?? null,
    display_name: getDisplayName(claims),
    role,
  };
}

function getBootstrapRole(claims: Claims): AppRole | null {
  const email = claims.email?.toLowerCase();

  if (!email) {
    return null;
  }

  const adminEmails = new Set(
    (process.env.APP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );

  return adminEmails.has(email) ? "admin" : null;
}
