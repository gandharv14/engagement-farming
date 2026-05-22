import { redirect } from "next/navigation";

import { ensureAppUser } from "@/lib/app-user";
import { auth0 } from "@/lib/auth0";
import { AppRole, Claims } from "@/lib/roles";

export type AppSessionUser = Claims & {
  role: AppRole;
};

export async function getCurrentUser(): Promise<AppSessionUser | null> {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return null;
    }

    const appUser = await ensureAppUser(session.user);

    if (!appUser?.role) {
      return null;
    }

    return {
      ...session.user,
      role: appUser.role,
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
    redirect(getHomePathForRole(user.role));
  }

  return user;
}

export function getHomePathForRole(role: AppRole) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "reviewer") {
    return "/review/queue";
  }

  return "/";
}
