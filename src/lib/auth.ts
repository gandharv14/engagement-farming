import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ensureAppUser } from "@/lib/app-user";
import { auth0 } from "@/lib/auth0";
import { e2eRoleHeader, getE2EAuthRole } from "@/lib/e2e-auth";
import { AppRole, Claims } from "@/lib/roles";

export type AppSessionUser = Claims & {
  role: AppRole;
};

export async function getCurrentUser(): Promise<AppSessionUser | null> {
  const e2eUser = await getE2EUser();

  if (e2eUser) {
    return e2eUser;
  }

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

async function getE2EUser(): Promise<AppSessionUser | null> {
  const role = getE2EAuthRole((await headers()).get(e2eRoleHeader));

  if (!role) {
    return null;
  }

  return {
    sub: `e2e|${role}`,
    email: `${role}@e2e.test`,
    name: `E2E ${role}`,
    role,
  };
}

export async function requireRole(allowed: AppRole | AppRole[]) {
  const user = await getCurrentUser();
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];

  if (!user) {
    redirect("/login");
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
