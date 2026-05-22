import { describe, expect, it } from "vitest";

import { getUserRoleFromClaims, isAppRole } from "./roles";

describe("roles", () => {
  it("recognizes only supported app roles", () => {
    expect(isAppRole("tasker")).toBe(true);
    expect(isAppRole("reviewer")).toBe(true);
    expect(isAppRole("admin")).toBe(true);
    expect(isAppRole("owner")).toBe(false);
    expect(isAppRole(null)).toBe(false);
  });

  it("extracts roles from namespaced, scalar, and array claims", () => {
    expect(getUserRoleFromClaims({ sub: "auth0|1", "https://app/role": "ADMIN" })).toBe("admin");
    expect(getUserRoleFromClaims({ sub: "auth0|1", role: "Reviewer" })).toBe("reviewer");
    expect(getUserRoleFromClaims({ sub: "auth0|1", roles: ["owner", "tasker"] })).toBe("tasker");
  });

  it("uses the first supported role in app role order for arrays", () => {
    expect(getUserRoleFromClaims({ sub: "auth0|1", roles: ["admin", "reviewer"] })).toBe("reviewer");
  });

  it("returns null when claims do not contain an app role", () => {
    expect(getUserRoleFromClaims({ sub: "auth0|1", role: "owner" })).toBeNull();
    expect(getUserRoleFromClaims({ sub: "auth0|1" })).toBeNull();
  });
});
