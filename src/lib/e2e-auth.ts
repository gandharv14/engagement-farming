import { type AppRole, isAppRole } from "@/lib/roles";

export const e2eRoleHeader = "x-e2e-role";

export function getE2EAuthRole(headerValue: string | null | undefined): AppRole | null {
  if (process.env.NODE_ENV === "production" || process.env.E2E_AUTH_BYPASS !== "1") {
    return null;
  }

  const role = headerValue?.toLowerCase();
  return isAppRole(role) ? role : null;
}
