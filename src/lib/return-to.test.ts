import { describe, expect, it } from "vitest";

import { getSafeLoginReturnTo, getSafeRelativePath } from "./return-to";

describe("return-to helpers", () => {
  it("preserves safe relative destinations", () => {
    expect(getSafeRelativePath("/admin/reviewers?tab=active")).toBe("/admin/reviewers?tab=active");
    expect(getSafeLoginReturnTo("/admin/reviewers")).toBe("/admin/reviewers");
  });

  it("falls back for unsafe or login destinations", () => {
    expect(getSafeRelativePath("https://example.com/admin")).toBeNull();
    expect(getSafeRelativePath("//example.com/admin")).toBeNull();
    expect(getSafeLoginReturnTo("/login?returnTo=/admin")).toBe("/");
    expect(getSafeLoginReturnTo(undefined)).toBe("/");
  });
});
