export const roles = ["tasker", "reviewer", "admin"] as const;
const roleClaimKeys = ["https://app/role", "https://app/roles", "role", "roles"] as const;

export type AppRole = (typeof roles)[number];

export type Claims = {
  sub: string;
  email?: string;
  name?: string;
  nickname?: string;
  [key: string]: unknown;
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && roles.includes(value as AppRole);
}

export function getUserRoleFromClaims(claims: Claims): AppRole | null {
  for (const claimKey of roleClaimKeys) {
    const role = getRoleFromClaimValue(claims[claimKey]);

    if (role) {
      return role;
    }
  }

  return null;
}

function getRoleFromClaimValue(value: unknown): AppRole | null {
  if (typeof value === "string") {
    return normalizeAppRole(value);
  }

  if (Array.isArray(value)) {
    const normalizedRoles = value.map(normalizeAppRole);

    return roles.find((role) => normalizedRoles.includes(role)) ?? null;
  }

  return null;
}

function normalizeAppRole(value: unknown): AppRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const role = value.toLowerCase();
  return isAppRole(role) ? role : null;
}
