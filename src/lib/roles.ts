export const roles = ["tasker", "reviewer", "admin"] as const;

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
  const role = claims["https://app/role"];
  return isAppRole(role) ? role : null;
}
