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

export function getDefaultAppRole(): AppRole {
  const role = process.env.DEFAULT_APP_ROLE?.toLowerCase();
  return isAppRole(role) ? role : "tasker";
}

export async function ensureAppUser(claims: Claims): Promise<AppUserRecord | null> {
  const supabase = createSupabaseAdminClient();
  const fallbackRole = getUserRoleFromClaims(claims) ?? getBootstrapRole(claims) ?? getDefaultAppRole();

  if (!supabase) {
    return {
      id: "00000000-0000-0000-0000-000000000000",
      auth0_sub: claims.sub,
      email: claims.email ?? null,
      display_name: getDisplayName(claims),
      role: fallbackRole,
    };
  }

  const { data: existing } = await supabase.from("users").select(appUserSelect).eq("auth0_sub", claims.sub).maybeSingle();
  const role = ((existing as AppUserRecord | null)?.role ?? fallbackRole) as AppRole;

  const { data } = await supabase
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

  return (data as AppUserRecord | null) ?? ((existing as AppUserRecord | null) || null);
}

function getDisplayName(claims: Claims) {
  return claims.name ?? claims.nickname ?? claims.email ?? "Labelbox User";
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
