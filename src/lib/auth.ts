import { redirect } from "next/navigation";

import { auth0 } from "@/lib/auth0";
import { AppRole, Claims, getUserRoleFromClaims } from "@/lib/roles";

export type AppSessionUser = Claims & {
  role: AppRole;
};

export async function getCurrentUser(): Promise<AppSessionUser | null> {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return null;
    }

    const role = getUserRoleFromClaims(session.user);

    if (!role) {
      return null;
    }

    return {
      ...session.user,
      role,
    };
  } catch {
    return null;
  }
}

export async function requireRole(allowed: AppRole | AppRole[]) {
  const user = await getCurrentUser();
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];

  if (!user) {
    redirect("/api/auth/login");
  }

  if (!allowedRoles.includes(user.role)) {
    redirect("/forbidden");
  }

  return user;
}
